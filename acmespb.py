import requests
import urllib.parse
import json
import re
import math
import hashlib

from bs4 import BeautifulSoup

headers = {
    'Referer': 'https://www.acmespb.ru/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.89 Safari/537.36'
}
proxies = {
    'http': 'socks5://127.0.0.1:1079',
    'https': 'socks5://127.0.0.1:1079'
}
per_page = 50

session = requests.Session()
session.proxies.update(proxies)
session.headers.update(headers)


class AcmeException(Exception):
    pass


class AcmePharmacy:
    def __init__(self, name='', address='', phone='', geo=None):
        self.name = name
        self.address = address
        self.phone = phone
        self.geo = geo

    def as_dict(self):
        dict = self.__dict__
        dict['hash'] = hashlib.md5(("%s|%s" % (self.address, self.name)).encode('utf-8')).hexdigest()
        return dict


class AcmeOffer:
    def __init__(self, name='', country='', pharmacy=None, price=None):
        self.name = name
        self.country = country
        self.pharmacy = pharmacy
        self.price = price

    def as_dict(self):
        dict = self.__dict__
        dict['pharmacy'] = self.pharmacy.as_dict()
        return dict


def search(query):
    url = "https://www.acmespb.ru/lib/autocomplete.php?term=" + urllib.parse.quote(query)
    r = session.get(url, allow_redirects=False)
    if r.text == "":
        return []

    r.encoding = "utf-8"
    return json.loads(r.text)


def trade_names(query):
    url = "https://www.acmespb.ru/search.php"
    r = session.post(url, {"free_str": query}, allow_redirects=False)
    if r.status_code != 301:
        raise AcmeException("status_code is %d" % (r.status_code,))
    if '/trade/' not in r.headers["location"]:
        return r.headers["location"], None

    r = session.get(r.headers["location"], allow_redirects=False)
    r.encoding = "utf-8"
    soup = BeautifulSoup(r.text, "html.parser")
    trades = soup.find(id="trades")
    return None, [opt.string for opt in trades.find_all("option") if opt["value"] != "all"]


def _get_location(query):
    url = "https://www.acmespb.ru/search.php"
    data = {"free_str": query}
    r = session.post(url, data, allow_redirects=False)
    return r.headers["location"]


def offers(query, target_url=None, page=1):
    if target_url is None:
        target_url = _get_location(query)

    data = {
        "free_str": query,
        "page": page
    }
    r = session.post(target_url, data, allow_redirects=False)
    r.encoding = "utf-8"
    if r.status_code != 200:
        raise AcmeException("status_code is %d, expected 200" % (r.status_code,))

    pages = 1

    soup = BeautifulSoup(r.text, "html.parser")
    p = soup.find("p", class_="red")
    if p:
        try:
            total_matches = int(re.findall("([0-9]+)", p.string)[0])
            pages = math.ceil(total_matches / per_page)
        except IndexError:
            raise AcmeException(p.string)

    offer_list = []
    for trow in soup.find_all('div', class_='trow'):
        if 'thead' in trow['class']:
            continue

        name = trow.select_one('.cell.name p.sra').text
        country = trow.select_one('.cell.country').text
        phname = trow.select_one('.cell.pharm a').text
        price = float(trow.select_one('.cell.pricefull').text)

        # parse address, geo coordinates and phone number
        addr_div = trow.select_one('.cell.address')
        phone = re.findall('тел\.([^<]+)', addr_div.text)[0].strip()

        addr_link = addr_div.select_one('a')
        address = addr_link.text

        geo = re.findall('text=([0-9\.]+),([0-9\.]+)', addr_link['href'])[0]
        geo = list(map(lambda x: float(x), geo))

        acmepharm = AcmePharmacy(name=phname, address=address, phone=phone, geo=geo)
        acmeoffer = AcmeOffer(name=name, country=country, price=price, pharmacy=acmepharm)

        offer_list.append(acmeoffer)

    return target_url, pages, offer_list