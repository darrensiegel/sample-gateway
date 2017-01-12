var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');
var amqp = require('amqplib/callback_api');

// Track outstanding requests that are awaiting a response
var pendingCallbacks = {};

var registerCallback = function(callback) {
  pendingCallbacks[callback.correlationId] = callback;
}

var unregisterCallback = function(callback) {
  delete pendingCallbacks[callback.correlationId];
}

// configure app to use bodyParser()
// this will let us get the data eventually from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;        // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

var cache = {};


// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to our api!' });
});

router.route('/data/:source')
    .get(function(req, res) {

        let message = { type: req.params.source };

        if (cache[message.type] !== undefined) {
          res.json(cache[message.type]);
        } else {

          console.log("Sending data request: " + JSON.stringify(message));

          sendMessage(message)
            .then(result => {
              cache[message.type] = result;
              res.json(result)
            });
        }

    });

router.route('/cache')
    .delete(function(req, res) {

        cache = {};

        res.json({ done: true });
    });

router.route('/authRequest')
    .get(function(req, res) {

        let message = { type: 'hasAuthorization' };
        message.actor = req.query.actor;
        message.action = req.query.action;
        message.item = req.query.item;

        console.log("Sending authRequest: " + JSON.stringify(message));

        sendMessage(message)
          .then(result => res.json(result));
    });


// CORS configuration
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// A functional wrapper around the rabbitmq rpc mechanism
// Returns a promise that resolves once the rpc is acked
var serviceCaller = function(ch, replyQueue, message) {
  return new Promise(function(resolve, reject) {
    var corr = generateUuid();

    var callback = function(msg) {
      if (msg.properties.correlationId == corr) {
        unregisterCallback(callback);
        resolve(JSON.parse(msg.content.toString()));
      }
    }
    callback.correlationId = corr;

    registerCallback(callback);

    console.log("Sending message: " + message);

    ch.sendToQueue('auth-rpc-queue',
      new Buffer(JSON.stringify(message)),
      { correlationId: corr, replyTo: replyQueue.queue });

  });
}

var sendMessage;


// START THE SERVER
// =============================================================================

amqp.connect('amqp://my-rabbit', function(err, conn) {

  conn.createChannel(function(err, ch) {

    ch.assertQueue('auth-rpc-queue-reply', {exclusive: true}, function(err, q) {

      ch.consume(q.queue, function(msg) {

        console.log("Received reply: " + msg);

        Object.keys(pendingCallbacks).filter(k => k === msg.properties.correlationId)
          .forEach(k => pendingCallbacks[k](msg));

      }, {noAck: true});

      // Now that we have the channel and queue information, bind
      // it to our service caller
      sendMessage = serviceCaller.bind(this, ch, q);

      app.listen(port);
      console.log('Gateway listening on port ' + port);

    });
  });
});

function generateUuid() {
  return Math.random().toString() +
         Math.random().toString() +
         Math.random().toString();
}
