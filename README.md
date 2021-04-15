# node-gpsd-client

A Nodejs GPSD client

Forked from and heavily inspired by [Node GPSD project](https://github.com/eelcocramer/node-gpsd), with a few little differences:

- GPSD client only
- No builtin logger
- Using message buffer to overcome TCP fragmentation
- Auto reconnect if connection suddently dropped

## Usage Example

```javascript
const Gpsd = require('node-gpsd-client')
const client = new Gpsd({
  port: 2947,              // default
  hostname: 'localhost',   // default
  parse: true
})

client.on('connected', () => {
  console.log('Gpsd connected')
  client.watch({
    class: 'WATCH',
    json: true,
    scaled: true
  })
})

client.on('error', err => {
  console.log(`Gpsd error: ${err.message}`)
})

client.on('TPV', data => {
  console.log(data)
})

client.connect()
```

## Options

- `port`: set GPSD port, defaults to **2947**
- `hostname`: set GPSD hostname, defaults to **localhost**
- `parse`: parse data as JSON object
- `reconnectThreshold`: max seconds to consider connection is dead since last data received, defaults to **0**
- `reconnectInterval`: interval in seconds to detect a connection, defaults to **0**

Reconnection will only run when both `reconnectThreshold` and `reconnectInterval` is greater than 0.

License: MIT