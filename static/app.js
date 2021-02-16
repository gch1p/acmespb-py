class Search {
  constructor() {
    this.searchDebounced = _.debounce((query) => {
      if (query.length < 3)
        return;

      fetch(`/hints.ajax?q=${encodeURIComponent(query)}`)
        .then(response => {
          if (!response.ok)
            throw new Error(`statusText is ${response.statusText}`);

          return response.json();
        })
        .then(({response, error}) => {
          this.unlockButton();

          if (error)
            throw new Error(error);

          this.autoComplete.setData(response.map(item => {
            return {label: item, value: ''};
          }));
          this.autoComplete.renderIfNeeded();
        })
    }, 150);

    this._filterDebounced = _.debounce((e) => {
      let filter = e.target;
      globalMaps.setFilter(filter.value);
    }, 500)

    let field = document.getElementById('queryInput');
    let btn = document.getElementById('querySubmit');
    let filterField = document.getElementById('filterInput');

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
    filterField.addEventListener('input', this._filterDebounced);

    this.btn = btn;
    this.field = field;
  }

  onInputKeyDown = (e) => {
    if (e.keyCode === 10 || e.keyCode === 13)
      this.onSubmit();
  }

  getOffers(query, page) {
    fetch(`/offers.ajax?q=${encodeURIComponent(this.field.value)}&page=${page}`)
      .then(response => {
        if (!response.ok)
          throw new Error(`statusText is ${response.statusText}`);

        return response.json();
      })
      .then(({error, tradeNames, end, offers, pages}) => {
        if (error)
          throw new Error(error);

        if (tradeNames) {
          this.autoComplete.setData(tradeNames.map(item => {
            return {label: item, value: ''};
          }));
          this.autoComplete.renderIfNeeded();
          return this.unlockButton();
        }

        for (let offer of offers)
          globalMaps.addOffer(offer);

        if (page >= pages) {
          return this.unlockButton();
        } else {
          this.lockButton(pages > 1 ? `${page} из ${pages}` : null);
          setTimeout(() => {
            this.getOffers(query, page + 1);
          }, 1000)
        }
      })
      .catch((error) => {
        console.error(error);
        alert(error);
        this.unlockButton();
      })
  }

  onSubmit = (e) => {
    if (this.isLocked())
      return;

    this.lockButton('Загрузка...');

    globalMaps.removeAllPoints();

    this.getOffers(this.field.value, 1);
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

    this.filter = null;
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
    else
      this.places[hash] = {offers: [offer]};

    if (!this.places[hash].mark && this.isAllowed(offer.name))
      this.showPlaceOnMap(hash, offer);
  }

  showPlaceOnMap(hash, offer) {
    this.places[hash].mark = this.addPoint({
      geo: offer.pharmacy.geo,
      hint: offer.pharmacy.name,
      pharmacyName: offer.pharmacy.name,
      pharmacyAddress: offer.pharmacy.address,
      pharmacyPhone: offer.pharmacy.phone,
      offersRef: this.places[hash].offers
    });
  }

  hidePlaceFromMap(hash) {
    if (this.places[hash].mark) {
      this.map.geoObjects.remove(this.places[hash].mark);
      delete this.places[hash].mark;
    }
  }

  setFilter(filter) {
    if (!filter)
      filter = null;
    this.filter = filter;

    for (let hash in this.places) {
      if (!this.places.hasOwnProperty(hash))
        continue;

      let pl = this.places[hash];
      let ok = pl.offers.filter(o => this.isAllowed(o.name))

      if (pl.mark && !ok.length)
        this.hidePlaceFromMap(hash);

      else if (!pl.mark && ok.length)
        this.showPlaceOnMap(hash, ok[0]);
    }
  }

  isAllowed(productName) {
    return this.filter === null || productName.indexOf(this.filter) !== -1;
  }
}

let globalMaps = null;
let globalSearch = null;

window.addEventListener('DOMContentLoaded', function() {
  globalSearch = new Search();
  globalMaps = new Maps();
});