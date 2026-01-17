db = db.getSiblingDB('modify_me_accordignly');
db.createCollection('visits');
db.visits.insertMany([
  {
    visit_dt: new Date(),
    ip: '127.0.0.1',
    user_agent: 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 5.1; Trident/4.0)'
  },
  {
    visit_dt: new Date(),
    ip: '127.0.0.1',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15.7; rv:143.0) Gecko/20100101 Firefox/143.0'
  },
  {
    visit_dt: new Date(),
    ip: '10.0.0.1',
    user_agent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0'
  },
  {
    visit_dt: new Date(),
    ip: '192.168.1.52',
    user_agent: 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 5.1; Trident/4.0)'
  },
  {
    visit_dt: new Date(),
    ip: '10.0.1.5',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko'
  },
  {
    visit_dt: new Date(),
    ip: '10.0.0.150',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
  },
]);
