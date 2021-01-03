class Search {
  constructor() {
    this.searchDebounced = _.debounce((query) => {
      if (query.length < 3)
        return;
      this.socket.emit('get_hints', {
        id: this.updateRequestId(),
        query
      });
    }, 150);

    let field = document.getElementById('queryInput');
    let btn = document.getElementById('querySubmit');

    this.autoComplete = new Autocomplete(field, {
      data: [],
      maximumItems: 10,
      onInput: (value) => {
        this.searchDebounced(value);
      },
      onSelectItem: ({label}) => {
        // console.log('selected:', label)
      },
      highlightClass: 'text-danger'
    });

    btn.addEventListener('click', this.onSubmit);
    field.addEventListener('keydown', this.onInputKeyDown);

    this.btn = btn;
    this.field = field;

    this.socket = io();
    this.socket.on('hints', this.onHints);
    this.socket.on('offers', this.onOffers)
  }

  updateRequestId() {
    this.requestId = requestId();
    return this.requestId;
  }

  onInputKeyDown = (e) => {
    if (e.keyCode === 10 || e.keyCode === 13)
      this.onSubmit();
  }

  onSubmit = (e) => {
    if (this.isLocked())
      return;

    this.lockButton('Загрузка...');

    gMaps.removeAllPoints();
    this.socket.emit('get_offers', {
      id: this.updateRequestId(),
      query: this.field.value
    });
  }

  onHints = (data) => {
    if (data.id !== this.requestId)
      return;

    this.unlockButton();

    if (data.error) {
      console.warn(data.error);
      return;
    }

    this.autoComplete.setData(data.response.map(item => {
      return {label: item, value: ''};
    }));
    this.autoComplete.renderIfNeeded();
  }

  onOffers = (data) => {
    if (data.id !== this.requestId)
      return;

    if (data.end) {
      this.unlockButton();
      return;
    } else {
      this.lockButton(data.pages > 1 ? `${data.page} из ${data.pages}` : null);
    }

    for (let offer of data.offers)
      gMaps.addOffer(offer);
  }

  isLocked() {
    return this.btn.classList.contains('disabled');
  }

  lockButton(text) {
    if (text !== null)
      this.btn.innerText = text;
    this.btn.classList.add('disabled');
  }

  unlockButton() {
    this.btn.classList.remove('disabled');
    this.btn.innerText = 'Поиск';
  }
}


class Maps {
  constructor() {
    /**
     * @type {ymaps.Map}
     */
    this.map = null;
    ymaps.ready(this.onInit);

    this.places = {};
  }

  onInit = () => {
    this.map = new ymaps.Map("mapContainer", {
      center: [59.94, 30.32],
      zoom: 11
    });
    this.map.controls.remove('searchControl');
  }

  addPoint({geo, offersRef, hint, pharmacyName, pharmacyAddress, pharmacyPhone}) {
    let mark = new ymaps.Placemark(geo, {
      hintContent: hint,
    }, {
      preset: 'islands#dotIcon',
      openEmptyBalloon: true,
      iconColor: '#3caa3c'
    });
    mark.events.add('balloonopen', e => {
      let lines = offersRef.map(offer => {
        return `${offer.name} (${offer.price} руб.)`
      });
      let html = `<b>${pharmacyName}</b><br>`;
      html += `${pharmacyAddress}<br>`;
      html += `тел: ${pharmacyPhone}<br><br>`;
      html += lines.join('<br>');
      mark.properties.set('balloonContent', html);
    });
    this.map.geoObjects.add(mark);
    return mark;
  }
  
  removeAllPoints() {
    this.map.geoObjects.removeAll();
  }

  addOffer(offer) {
    // console.log('[addOffer]', offer);
    let hash = offer.pharmacy.hash;
    if (hash in this.places)
      this.places[hash].offers.push(offer);
    else {
      this.places[hash] = {
        offers: [offer],
      };
      this.places[hash].mark = this.addPoint({
        geo: offer.pharmacy.geo,
        hint: offer.pharmacy.name,
        pharmacyName: offer.pharmacy.name,
        pharmacyAddress: offer.pharmacy.address,
        pharmacyPhone: offer.pharmacy.phone,
        offersRef: this.places[hash].offers
      });
    }
  }
}


function requestId() {
  return _.random(1, 99999999);
}


let gMaps, gSearch;

window.addEventListener('DOMContentLoaded', function() {
  gSearch = new Search();
  gMaps = new Maps();

   // document.getElementById('test').addEventListener('click', () => {
   //   gMaps.addTestPoint();
   // });
});