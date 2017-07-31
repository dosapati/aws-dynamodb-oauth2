// Include the cluster module
var cluster = require('cluster');


// Code to run if we're in the master process
if (cluster.isMaster) {

    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;

    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        cluster.fork();
    }

    // Listen for terminating workers
    cluster.on('exit', function (worker) {

        // Replace the terminated workers
        console.log('Worker ' + worker.id + ' died :(');
        cluster.fork();

    });

// Code to run if we're in a worker process
} else {
	const AWS = require('aws-sdk');
    const express = require('express');
    const bodyParser = require('body-parser');
    const client         = require('./authserver/client');
    const cookieParser   = require('cookie-parser');
    const config         = require('./config');
    const aws_config         = require('./aws/aws-config');
    const db             = require('./db');
    const fs             = require('fs');
    const https          = require('https');
    const oauth2         = require('./authserver/oauth2');
    const passport       = require('passport');
    const path           = require('path');
    const site           = require('./authserver/site');
    const token          = require('./authserver/token');
    const user           = require('./authserver/user');
    const clients           = require('./db/clients');

    AWS.config.region = "us-east-1";

    var sns = new AWS.SNS();
    var ddb = new AWS.DynamoDB();

    var ddbTable =  aws_config.config.dynamodb.signupTable;
    var snsTopic =  aws_config.config.sns.snsTopic;
    
    var app = express();
    app.use(cookieParser());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.use(passport.initialize());
    app.use(passport.session());

    // Passport configuration
    require('./authserver/auth');

    app.set('view engine', 'ejs');
    app.set('views', __dirname + '/views');
    app.use(bodyParser.urlencoded({extended:false}));
    //app.use(express.static(__dirname + '/public'));
    app.use('/static', express.static(__dirname + '/static'));

    app.get('/', function(req, res) {
        res.render('index', {
            static_path: 'static',
            theme: process.env.THEME || 'flatly',
            flask_debug: process.env.FLASK_DEBUG || 'false'
        });
    });
    
    app.post('/oauth/token',               oauth2.token);
    //clients.saveClientsToAWS(function (){});


    /**
     * sample to protect all resources using bearer token strategy for a specific url pattern
     */
    app.all('/api2/*', passport.authenticate('bearer', { session: false }),function(req, res, next){
        
        next();
    });

    /**
     * sample to protect all resources using basic token strategy for a specific url pattern
     */
    app.all('/api3/*', passport.authenticate('basic', { session: false }),function(req, res, next){
        
        next();
    });

    app.get('/api/userinfo',   user.info);
    app.get('/api/userinfo1',   user.info1);

    app.get('/api2/userinfo2',   user.info2);
    app.get('/api/clientinfo', client.info);
    app.get('/api3/test',   function(req,res){
    		res.send("API3 test using basic authentication");
    });
    
 // Mimicking google's token info endpoint from
 // https://developers.google.com/accounts/docs/OAuth2UserAgent#validatetoken
 app.get('/api/tokeninfo', token.info);

 // Mimicking google's token revoke endpoint from
 // https://developers.google.com/identity/protocols/OAuth2WebServer
 app.get('/api/revoke', token.revoke);

 app.use((err, req, res, next) => {
	  if (err) {
	    if (err.status == null) {
	      console.error('Internal unexpected error from:', err.stack);
	      res.status(500);
	      res.json(err);
	    } else {
	      res.status(err.status);
	      res.json(err);
	    }
	  } else {
	    next();
	  }
	});
 
// From time to time we need to clean up any expired tokens
// in the database
setInterval(() => {
db.accessTokens.removeExpired()
.catch(err => console.error('Error trying to remove expired tokens:', err.stack));
}, config.db.timeToCheckExpiredTokens * 1000);

    app.post('/signup2', function(req, res) {
        var item = {
            'email': {'S': req.body.email},
            'name': {'S': req.body.name},
            'preview': {'S': req.body.previewAccess},
            'theme': {'S': req.body.theme}
        };

        ddb.putItem({
            'TableName': ddbTable,
            'Item': item,
            'Expected': { email: { Exists: false } }        
        }, function(err, data) {
            if (err) {
                var returnStatus = 500;

                if (err.code === 'ConditionalCheckFailedException') {
                    returnStatus = 409;
                }

                res.status(returnStatus).end();
                console.log('DDB Error: ' + err);
            } else {
                sns.publish({
                    'Message': 'Name: ' + req.body.name + "\r\nEmail: " + req.body.email 
                                        + "\r\nPreviewAccess: " + req.body.previewAccess 
                                        + "\r\nTheme: " + req.body.theme,
                    'Subject': 'New user sign up!!!',
                    'TopicArn': snsTopic
                }, function(err, data) {
                    if (err) {
                        res.status(500).end();
                        console.log('SNS Error: ' + err);
                    } else {
                        res.status(201).end();
                    }
                });            
            }
        });
    });
    

    var port = process.env.PORT || 3000;
    
 // TODO: Change these for your own certificates. This was generated through
	// the commands:
 // openssl genrsa -out privatekey.pem 2048
 // openssl req -new -key privatekey.pem -out certrequest.csr
 // openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out
	// certificate.pem
 const options = {
   key  : fs.readFileSync(path.join(__dirname, 'certs/privatekey.pem')),
   cert : fs.readFileSync(path.join(__dirname, 'certs/certificate.pem')),
 };

 // Create our HTTPS server listening on port 3000.
 //var httpsServer = https.createServer(/*options,*/ app);
 
 app.listen(port, function(){
     console.log("server running at http://127.0.0.1:"+port+"/")
 });
 
 // console.log('PowerUp V0.1 Server started on port '+port);


    /*
	 * var server = app.listen(port, function () { console.log('Server running
	 * at http://127.0.0.1:' + port + '/'); });
	 */
}