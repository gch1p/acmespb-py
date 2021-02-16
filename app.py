import logging
import traceback
import acmespb

from flask import Flask, render_template, jsonify, request


app = Flask(__name__)
app.config.from_mapping(SECRET_KEY='dev', JSON_AS_ASCII=False)

logger = logging.getLogger('app')


@app.after_request
def add_header(r):
    """
    Add headers to both force latest IE rendering engine or Chrome Frame,
    and also to cache the rendered page for 10 minutes.
    """
    r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    r.headers["Pragma"] = "no-cache"
    r.headers["Expires"] = "0"
    r.headers['Cache-Control'] = 'public, max-age=0'
    return r


@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')


@app.route('/hints.ajax', methods=['GET'])
def ajax_hints():
    query = request.args.get('q') or ''
    if len(query) < 3:
        return jsonify(error="query is too short")

    results = acmespb.search(query)
    return jsonify(response=results)


@app.route('/offers.ajax', methods=['GET'])
def ajax_offers():
    query = request.args.get('q') or ''
    page = request.args.get('page') or 1
    target_url = request.args.get('target_url') or ''

    try:
        if page == 1 or not target_url:
            target_url, trade_names = acmespb.trade_names(query)
            if trade_names:
                return jsonify(tradeNames=trade_names)

        target_url, pages, offers = acmespb.offers(query, page=page, target_url=target_url)
    except Exception as e:
        traceback.print_exc()
        return jsonify(error=str(e))

    return jsonify(
        offers=[offer.as_dict() for offer in offers],
        pages=pages
    )

    # TODO support empty results


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)