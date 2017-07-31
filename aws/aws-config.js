const AWS = require('aws-sdk');

AWS.config.region = "us-east-1";

var config={}

/**
 * Database configuration for access and refresh tokens.
 *
 * timeToCheckExpiredTokens - The time in seconds to check the database for expired access tokens.
 *                            For example, if it's set to 3600, then that's one hour to check for
 *                            expired access tokens.
 */
config.dynamodb = {
  signupTable : "P002",
  clientTable : "P002Client"
};

config.sns = {
		snsTopic:"arn:aws:sns:us-east-1:747363780176:snsTopic"
}
module.exports = {AWS:AWS,config:config} 

	
	