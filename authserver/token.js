'use strict';

const db       = require('../db');
const validate = require('./validate');

const async = require('async');



/**
 * This endpoint is for verifying a token.  This has the same signature to
 * Google's token verification system from:
 * https://developers.google.com/accounts/docs/OAuth2UserAgent#validatetoken
 *
 * You call it like so
 * https://localhost:3000/api/tokeninfo?access_token=someToken
 *
 * If the token is valid you get returned
 * {
 *   "audience": someClientId
 * }
 *
 * If the token is not valid you get a 400 Status and this returned
 * {
 *   "error": "invalid_token"
 * }
 * @param   {Object}  req - The request
 * @param   {Object}  res - The response
 * @returns {Promise} Returns the promise for testing only
 */

exports.info = (req, res) =>{
	async.waterfall([function(callback){validate.tokenForHttp(req.query.access_token);callback()},
		function(callback){
		db.accessTokens.find(req.query.access_token,callback)
				//console.log("got  token from DB  --> "+token+" -->"+JSON.stringify(token,null,2));

		//callback(null,token)
	},function(token,callback){
		console.log("~~~~~~ validating token --> "+token.clientID+" -->"+JSON.stringify(token,null,2));
		  validate.tokenExistsForHttpCallback(token,callback)
	},function(token,callback){
		db.clients.findCallback(token.clientID,token,callback)
	},function(token,client,callback){
		var result = { client, token };
		const expirationLeft = Math.floor((token.expirationDate.getTime() - Date.now()) / 1000);
	    callback(null,{ audience : client.clientId, expires_in : expirationLeft });
	}],
		function(err, result) {
		if(err){
			res.status(401);
		    res.json({ error: "Invalid token" });
		}else{
		console.log('result -->>>'+result)
	    // optional callback
		 res.status(200);
		    res.json(result);
		}
	})
}

exports.info1 = (req, res) =>
  validate.tokenForHttp(req.query.access_token)
  //.then(db.accessTokens.find(req.query.access_token))
  .then(() => {
	  db.accessTokens.find(req.query.access_token)
	  })
  .then(token => {
	  console.log("validating token --> "+token+" -->"+JSON.stringify(token,null,2));
	  validate.tokenExistsForHttp(token)
	  })
  .then(token =>
    db.clients.find(token.clientID)
    .then(client => validate.clientExistsForHttp(client))
    .then(client => ({ client, token })))
  .then(({ client, token }) => {
    const expirationLeft = Math.floor((token.expirationDate.getTime() - Date.now()) / 1000);
    res.json({ audience : client.clientId, expires_in : expirationLeft });
  })
  .catch((err) => {
	  
	  //console.log('UserId in Error-->>'+db.accessTokens.find(req.query.access_token).userID);
	  console.log('error -->'+err.message+" ... "+validate.tokenExistsForHttp(req.query.access_token));
    res.status(err.status);
    res.json({ error: err.message });
  });

/**
 * This endpoint is for revoking a token.  This has the same signature to
 * Google's token revocation system from:
 * https://developers.google.com/identity/protocols/OAuth2WebServer
 *
 * You call it like so
 * https://localhost:3000/api/revoke?token=someToken
 *
 * If the token is valid you get returned a 200 and an empty object
 * {}
 *
 * If the token is not valid you get a 400 Status and this returned
 * {
 *   "error": "invalid_token"
 * }
 * This will first try to delete the token as an access token.  If one is not found it will try and
 * delete the token as a refresh token.  If both fail then an error is returned.
 * @param   {Object}  req - The request
 * @param   {Object}  res - The response
 * @returns {Promise} Returns the promise for testing
 */
exports.revoke = (req, res) =>
  validate.tokenForHttp(req.query.token)
  .then(() => db.accessTokens.delete(req.query.token))
  .then((token) => {
    if (token == null) {
      return db.refreshTokens.delete(req.query.token);
    }
    return token;
  })
  .then(tokenDeleted => validate.tokenExistsForHttp(tokenDeleted))
  .then(() => {
    res.json({});
  })
  .catch((err) => {
    res.status(err.status);
    res.json({ error: err.message });
  });
