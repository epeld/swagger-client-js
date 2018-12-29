/*
 * This is some example code for testing out the library
 */

const fs = require("fs");

const requestLib = require("request");
const _ = require("lodash");

const myswagger = JSON.parse(fs.readFileSync("./samples/swagger.json"));

const myreq = requestLib.defaults({baseUrl: 'http://localhost:3000'});

const { generateClient } = require("./lib");


// Set up defaults for http agent
const request = requestLib.defaults({baseUrl: 'http://localhost:6060'});


// Generate the client, passing in the configured request-object
const client = generateClient(myswagger, request);


// Make a call to add a pet
const req = {body: {name: "Foobar", photoUrls: []}};
client.addPet(req, request).then(console.log).catch(console.error);
