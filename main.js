
const fs = require("fs");

const decamelize = require("decamelize");
const requestLib = require("request");
const _ = require("lodash");

const swagger = JSON.parse(fs.readFileSync("swagger.json"));

console.log(JSON.stringify(Object.keys(swagger)));

const myreq = requestLib.defaults({baseUrl: 'http://localhost:3000'});

const checkArg = (argSpec, arg) => {
  if (argSpec === undefined) {
    return `Superfluous argument: ${JSON.stringify(arg)}`;
  }
  // console.log(`Checking argument '${argSpec.name}'...`);
  if (argSpec.required) {
    switch(argSpec.type) {
    case "string":
      if (typeof arg !== "string") {
        return `Argument ${argSpec.name} is not a string: ${arg}`;
      }
      break;

    default:
      return `Unsupported argument type '${argSpec.type}'`;
    }
  }

  
  return null;
};

const httpClient = (req, request) => {
  const {method, args, path, spec} = req;
  const errors = _.compact(_.zipWith(spec.parameters, args, checkArg));
  if (errors.length) {
    return Promise.reject(`Errors in arg list: ${errors.join('\n')}`);
  } else {
    console.log('No argument Errors');
  }

  const bodyArgs =
        _.fromPairs(
          _.compact(
            _.zipWith(spec.parameters, args,
                      (p, a) => (p && p.in === "body") ? [p.name, a] : null)
          )
        );
  const pathArgs =
        _.fromPairs(
          _.compact(
            _.zipWith(spec.parameters, args,
                      (p, a) => (p && p.in === "path") ? [p.name, a] : null)
          )
        );
 
  const url = path.split('/').map((part) => {
    const trimmed = _.trim(part);
    if (_.startsWith(trimmed, '{') &&
        _.endsWith(trimmed, '}')) {
      const argName = trimmed.substring(1, trimmed.length-1);
      if (!_.has(pathArgs, argName)) {
        throw new Error(`Internal error: missing path arg '${argName}'`);
      } else {
        return pathArgs[argName];
      }
    } else {
      return part;
    }
  }).join('/');

  console.log(`Constructed url '${url}', body: ${JSON.stringify(bodyArgs)}`);
  return new Promise((resolve, reject) => {
    request({url, method, form: bodyArgs}, (err, response, body) => {
      if (err) {
        reject(err);
      } else {
        // TODO verify response code is in list of responses from spec
        resolve(body);
      }
    });
  });
};

/**
 * Constructs a swagger client bound to the given "request-like"-object
 * (i.e, what you get back from calling request.defaults()).
 *
 * @param swagger this is the swagger JSON-structure
 * @param request (optional) the http client to use. See request.defaults
 */
export const generateClient = (swagger, request) => {
  request = request || requestLib.defaults();
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
        return httpClient(req, request);
      };
      client[name] = f;
      console.log(path, method, name);
    });
  });
  return client;
};


const client = generateClient(swagger);
client.get_timer('asd').then(console.log).catch(console.error);
