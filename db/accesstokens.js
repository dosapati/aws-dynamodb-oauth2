'use strict';

const jwt = require('jsonwebtoken');
const uuid = require('uuid/v4');
var AWS = require('../aws/aws-config').AWS;



// The access tokens.
// You will use these to access your end point data through the means outlined
// in the RFC The OAuth 2.0 Authorization Framework: Bearer Token Usage
// (http://tools.ietf.org/html/rfc6750)

/**
 * Tokens in-memory data structure which stores all of the access tokens
 */
let tokens = Object.create(null);

var ddb = new AWS.DynamoDB();

var ddbTable =  "P002AuthTokens";

/**
 * Returns an access token if it finds one, otherwise returns null if one is not found.
 * @param   {String}  token - The token to decode to get the id of the access token to find.
 * @returns {Promise} resolved with the token if found, otherwise resolved with undefined
 */
exports.find = (token,callback) => {
  try {
    const id = jwt.decode(token).jti;
    console.log('current tokens find for id->'+id);
    
    /*ddb.listTables({Limit: 10}, function(err, data) {
    	  if (err) {
    	    console.log("Error", err.code);
    	  } else {
    	    console.log("Table names are ", data.TableNames);
    	  }
    	});*/
    
    /*var params = {
    		  ExpressionAttributeValues: {
    		    ':userId' : {S: "4479ab74-9261-4cdd-9ad4-8ca75e0d3951"}
    		   },
    		   KeyConditionExpression: 'userId = :userId ',
    		 TableName: ddbTable
    		};

    ddb.query(params, function(err, data) {
    	    if (err) {
    	        console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
    	    } else {
    	        console.log("Query succeeded.");
    	        data.Items.forEach(function(item) {
    	            console.log(" -", item.userId.S + ": " + item.UUID.S);
    	        });
    	    }
    	});*/
    var params = {
  		  ExpressionAttributeValues: {
  			':jwtId' : {S: id}
  		   },
  		 FilterExpression: 'JWT_ID = :jwtId',
  		 TableName: ddbTable
  		};
    
    ddb.scan(params, function(err, data) {
  	    if (err) {
  	        console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
  	      callback(null,undefined);
  	    } else {
  	        console.log("Query succeeded.");
  	        var item = data.Items[0];
  	      console.log(" -", item.JWT_ID.S + ": " + item.ROW_UUID.S+" --- "+" --- "+item.EXPIRATION_DATE.S+" --- ");
	            var scope;
	       callback(null,{jwtId:item.JWT_ID.S,userID:item.USER_ID?item.USER_ID.S:null,clientID:item.CLIENT_ID.S,expirationDate:new Date(item.EXPIRATION_DATE.S),scope});
	        
  	    }
  	});
    
    /*return new Promise(
    	    function (resolve, reject) { // (A)
    	    	
    	    });*/
    //{ userID, expirationDate, clientID, scope }
    //return Promise.resolve(tokens[id]);
  } catch (error) {
	  callback(null,null);
  }
};

/**
 * Saves a access token, expiration date, user id, client id, and scope. Note: The actual full
 * access token is never saved.  Instead just the ID of the token is saved.  In case of a database
 * breach this prevents anyone from stealing the live tokens.
 * @param   {Object}  token          - The access token (required)
 * @param   {Date}    expirationDate - The expiration of the access token (required)
 * @param   {String}  userID         - The user ID (required)
 * @param   {String}  clientID       - The client ID (required)
 * @param   {String}  scope          - The scope (optional)
 * @returns {Promise} resolved with the saved token
 */
exports.save = (token, expirationDate, userID, clientID, scope) => {
	console.log("saving token -->"+token);
  const id = jwt.decode(token).jti;
  tokens[id] = { userID, expirationDate, clientID, scope };
  console.log('expirationDate -->'+expirationDate.toISOString()+" type is ->"+Object.prototype.toString.call(expirationDate));
  console.log('userID -->'+userID+" type is ->"+Object.prototype.toString.call(userID));
  
  console.log('clientID -->'+clientID+" type is ->"+Object.prototype.toString.call(clientID));
  console.log('scope -->'+scope+" type is ->"+Object.prototype.toString.call(scope));

  var item = {
		  'ROW_UUID' : {'S':uuid()},
          'JWT_ID' : {'S': id},
          'EXPIRATION_DATE': {'S': expirationDate.toISOString()},
          'CLIENT_ID': {'S': clientID},
          'SCOPE': {'S': 'ttl-60'},
          'TOKEN':{'S':token}
      };
  if(userID){
	  item['USER_ID'] =  {'S': userID}
  }

      ddb.putItem({
          'TableName': ddbTable,
          'Item': item,
          'Expected': { UUID: { Exists: false } }        
      }, function(err, data) {
    	  
    	  console.log('error is ----> '+err)
      });
  console.log('saving token for --->'+id);

  return Promise.resolve(tokens[id]);
};

/**
 * Deletes/Revokes an access token by getting the ID and removing it from the storage.
 * @param   {String}  token - The token to decode to get the id of the access token to delete.
 * @returns {Promise} resolved with the deleted token
 */
exports.delete = (token) => {
  try {
    const id = jwt.decode(token).jti;
    const deletedToken = tokens[id];
    delete tokens[id];
    return Promise.resolve(deletedToken);
  } catch (error) {
    return Promise.resolve(undefined);
  }
};

/**
 * Removes expired access tokens. It does this by looping through them all and then removing the
 * expired ones it finds.
 * @returns {Promise} resolved with an associative of tokens that were expired
 */
exports.removeExpired = () => {
  const keys    = Object.keys(tokens);
  const expired = keys.reduce((accumulator, key) => {
    if (new Date() > tokens[key].expirationDate) {
      const expiredToken = tokens[key];
      delete tokens[key];
      accumulator[key] = expiredToken; // eslint-disable-line no-param-reassign
    }
    return accumulator;
  }, Object.create(null));
  return Promise.resolve(expired);
};

/**
 * Removes all access tokens.
 * @returns {Promise} resolved with all removed tokens returned
 */
exports.removeAll = () => {
  const deletedTokens = tokens;
  tokens              = Object.create(null);
  return Promise.resolve(deletedTokens);
};
