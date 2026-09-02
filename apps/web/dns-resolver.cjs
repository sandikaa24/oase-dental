const dns = require('dns');

const originalLookup = dns.lookup;
const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1']);

dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname && (hostname.includes('supabase') || hostname.includes('amazonaws.com') || hostname.includes('googleapis.com'))) {
    resolver.resolve4(hostname, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        return originalLookup(hostname, options, callback);
      }
      if (options && options.all) {
        return callback(
          null,
          addresses.map((addr) => ({ address: addr, family: 4 }))
        );
      }
      return callback(null, addresses[0], 4);
    });
  } else {
    return originalLookup(hostname, options, callback);
  }
};
