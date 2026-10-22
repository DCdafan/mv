import json, sys, urllib.request, urllib.parse
titles = sys.argv[1:]
for i in range(0, len(titles), 40):
    q = urllib.parse.urlencode({"action":"query","titles":"|".join(titles[i:i+40]),"prop":"imageinfo","iiprop":"url|size|extmetadata|mediatype","format":"json"})
    req = urllib.request.Request("https://commons.wikimedia.org/w/api.php?"+q, headers={"User-Agent":"mv-study/0.1"})
    d = json.load(urllib.request.urlopen(req, timeout=30))
    for p in d["query"]["pages"].values():
        ii = p.get("imageinfo",[{}])[0]; m = ii.get("extmetadata",{})
        g = lambda k: m.get(k,{}).get("value","")
        print(f"{p['title']}\n   lic={g('LicenseShortName')} | dur={ii.get('duration')} | size={ii.get('size')} | artist={g('Artist')[:80]}\n   {ii.get('url')}")
