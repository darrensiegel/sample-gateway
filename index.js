var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');


var amqp = require('amqplib/callback_api');

var pendingCallbacks = {};

var registerCallback = function(callback) {
  pendingCallbacks[callback.correlationId] = callback;
}

var unregisterCallback = function(callback) {
  delete pendingCallbacks[callback.correlationId];
}

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;        // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to our api!' });
});

router.route('/authRequest')
    .post(function(req, res) {

        var authRequest = req.body;

        console.log("Sending authRequest: " + JSON.stringify(authRequest));

        boundCallService(authRequest)
          .then(function(result) {
            res.json(result);
          })
    });

// more routes for our API will happen here

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

var callService = function(ch, replyQueue, message) {
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

var boundCallService;


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

      boundCallService = callService.bind(this, ch, q);

      app.listen(port);
      console.log('Magic happens on port ' + port);

    });
  });
});

function generateUuid() {
  return Math.random().toString() +
         Math.random().toString() +
         Math.random().toString();
}
