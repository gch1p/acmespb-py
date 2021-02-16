import acmespb

if __name__ == "__main__":
    q_empty = "Волекам"
    q_many = "Верошпирон"

    #pprint(acmespb.trade_names("Марена красильная корневища и корни"))

    page = 1
    pages = 0
    target_url = None
    while pages == 0 or page <= pages:
        target_url, pages, offers = acmespb.offers(q_empty, page=page, target_url=target_url)
        print("[%d] pages=%d, target_url=%s" % (page, pages, target_url))
        for offer in offers:
            print(offer.as_dict())
        page += 1