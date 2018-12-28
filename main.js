/*
 * This is some example code for testing out the library
 */

const fs = require("fs");

const requestLib = require("request");
const _ = require("lodash");

const myswagger = JSON.parse(fs.readFileSync("swagger.json"));

const myreq = requestLib.defaults({baseUrl: 'http://localhost:3000'});

const { generateClient } = require("./lib");


const client = generateClient(myswagger);
const x = {
  body: {
    externalId: "asd",
    start: {
      type: "sunrise"
    },
    dayOfWeek: []
  }
};
//client.create_timer(x).then(console.log).catch(console.error);
client.get_timer({timerId: "3", external: "true"}).then(console.log).catch(console.error);

// const x = {
//   externalId: "1",
//   start: {
//     type: "time"
//   },
//   dayOfWeek: ["Mon"]
// };
// const err = checkSchema(myswagger, '#/definitions/CreateTimerRequest', x);
// if (err) {
//   console.error('\nError:');
//   console.error(err);
// }
