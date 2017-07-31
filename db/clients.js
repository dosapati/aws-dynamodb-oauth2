'use strict';

var aws_config = require('../aws/aws-config')
var async = require('async')
var ddb = new aws_config.AWS.DynamoDB();
var _ = require('underscore')

/**
 * This is the configuration of the clients that are allowed to connected to your authorization
 * server. These represent client applications that can connect. At a minimum you need the required
 * properties of
 *
 * id:           A unique numeric id of your client application
 * name:         The name of your client application
 * clientId:     A unique id of your client application
 * clientSecret: A unique password(ish) secret that is _best not_ shared with anyone but your
 *               client application and the authorization server.
 *
 * Optionally you can set these properties which are
 *
 * trustedClient: default if missing is false. If this is set to true then the client is regarded
 * as a trusted client and not a 3rd party application. That means that the user will not be
 * presented with a decision dialog with the trusted application and that the trusted application
 * gets full scope access without the user having to make a decision to allow or disallow the scope
 * access.
 */
var CLIENT_TABLE = aws_config.config.dynamodb.clientTable;
const clients = [{
  id            : '1',
  name          : 'Samplr',
  clientId      : 'abc123',
  clientSecret  : 'ssh-secret',
}, {
  id            : '2',
  name          : 'Samplr2',
  clientId      : 'xyz123',
  clientSecret  : 'ssh-password',
}, {
  id            : '3',
  name          : 'Samplr3',
  clientId      : 'trustedClient',
  clientSecret  : 'ssh-otherpassword',
  trustedClient : 'true',
}];

/**
 * Returns a client if it finds one, otherwise returns null if a client is not found.
 * @param   {String}   id   - The unique id of the client to find
 * @returns {Promise}  resolved promise with the client if found, otherwise undefined
 */
exports.find = id => Promise.resolve(clients.find(client => client.id === id));

exports.saveClientsToAWS = (callback) => {
	async.map(clients,function(o,callback){
	
		var item = {
	            'id': {'S': o.id},
	            'name': {'S': o.name},
	            'clientId': {'S': o.clientId},
	            'clientSecret': {'S': o.clientSecret},
	            //'trustedClient':{'S':o.trustedClient?o.trustedClient:null}
	        };
		if(o.trustedClient){
			item.trustedClient=o.trustedClient;
		}

	        ddb.putItem({
	            'TableName': CLIENT_TABLE,
	            'Item': item,
	            ConditionExpression:"attribute_not_exists(id)"
	        }, function(err, data) {
	            if (err) {
	                var returnStatus = 500;

	                if (err.code === 'ConditionalCheckFailedException') {
	                    returnStatus = 409;
	                }
	                callback(null,{status:'error',message:'error while inserting ->'+o.id});
	                console.log('DDB Error while inserting clients : ' + err);
	            } else {
	            		callback(null,{status:'success',message:'successfully inserted ->'+o.id});
	            }
	        });

		
	},function(e,r){
		var sList = _.filter(r,function(p){
			return p.status == 'success';
		})
		console.log("Done trying to insert "+sList.length+" of records successfully.");
		
	})
		
};

exports.findCallback = (id,token,callback) => {
	callback(null,token,clients.find(client => client.id === id))
};
exports.findCallbackById = (id,callback) => {
	
	var params = {
  		  ExpressionAttributeValues: {
  		    ':id' : {S: id}
  		   },
  		 KeyConditionExpression: 'id = :id ',
  		 TableName: CLIENT_TABLE
  		};
	

  ddb.query(params, function(err, data) {
  	    if (err) {
  	    		callback({err:"unable to query"},null);
  	        console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
  	    } else {
  	        console.log("Query succeeded.");
  	        if(data.Items && data.Items.length > 0){
  	        		var item = data.Items[0];
  	        		console.log("found -->"+item.name.S+" for --> "+id)
  	        		var retObj = {id:item.id.S,name:item.name.S,
  	        				clientId:item.clientId.S,clientSecret:item.clientSecret.S,trustedClient:item.trustedClient?item.trustedClient.S:null}
  	        		callback(null,retObj);
  	        }else{
  	        		callback({err:"no client record."},null);
  	        }
  	        
  	    }
  	});
	
	//callback(null,clients.find(client => client.id === id))
};



/**
 * Returns a client if it finds one, otherwise returns null if a client is not found.
 * @param   {String}   clientId - The unique client id of the client to find
 * @param   {Function} done     - The client if found, otherwise returns undefined
 * @returns {Promise} resolved promise with the client if found, otherwise undefined
 */
exports.findByClientId = clientId =>
  Promise.resolve(clients.find(client => client.clientId === clientId));
