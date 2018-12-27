
const fs = require("fs");

const decamelize = require("decamelize");
const request = require("request");
const _ = require("lodash");

const swagger = JSON.parse(fs.readFileSync("swagger.json"));

console.log(JSON.stringify(Object.keys(swagger)));

const httpClient = (req) => {
  const {method, args, path, spec} = req;
};

const generateClient = (swagger) => {
  const client = {};
  _.forEach(swagger.paths, (methods, path) => {
    _.forEach(methods, (spec, method) => {
      const {operationId} = spec;
      const name = decamelize(operationId);
      const f = function() {
        const args = [];
        for(let i = 0; i < arguments.length; i++) {
          args.push(arguments[i]);
        }
        console.log(name, 'called with args:', JSON.stringify(args));
        const req = {
          method, args, path, spec
        };
        httpClient(req);
      };
      client[name] = f;
      console.log(path, method, name);
    });
  });
  return client;
};


const client = generateClient(swagger);
client.create_timer(1, 2, {foo:15});
