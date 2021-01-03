import os
import time

from . import acmespb
from flask import Flask, render_template
from flask_socketio import SocketIO, emit

socketio = SocketIO()


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'app.sqlite'),
    )

    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)

    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    socketio.init_app(app)

    @app.route('/')
    def hello():
        return render_template('index.html')

    @socketio.on('get_hints')
    def handle_get_hints_event(q):
        print('[get_hints] id=%d, query=%s' % (q['id'], q['query']))
        if len(q['query']) < 3:
            response = {
                'id': q['id'],
                'error': "query is too short"
            }
            emit('hints', response)
            return
        results = acmespb.search(q['query'])
        response = {
            'id': q['id'],
            'response': results
        }
        emit('hints', response)

    @socketio.on('get_offers')
    def handle_get_offers_event(q):
        print('[get_offers] id=%d, query=%s' % (q['id'], q['query']))
        target_url, trade_names = acmespb.trade_names(q['query'])
        if trade_names:
            response = {
                'id': q['id'],
                "response": trade_names
            }
            emit('hints', response)
            return

        page = 1
        pages = 0
        target_url = None
        while pages == 0 or page <= pages:
            target_url, pages, offers = acmespb.offers(q['query'], page=page, target_url=target_url)
            print("[%d] pages=%d, target_url=%s" % (page, pages, target_url))
            response = {
                'id': q['id'],
                'offers': [offer.as_dict() for offer in offers],
                'page': page,
                'pages': pages
            }
            emit('offers', response)

            time.sleep(0.5)
            page += 1

        response = {
            'id': q['id'],
            'end': True
        }
        emit('offers', response)

        # TODO empty response

    return app
