const { 
	generateDisposeFunctionResponse,
	generateGetRemoteObjectResponse,
	generateCallRemoteFunctionResponse,
    generateInvalidParamsReponse,
    generateCallRemoteCallback
 } = require("./jsonRPCMessages");

 const uuid = require("uuid").v4;

const objects = {};
const remoteObjects = {};
const remoteFunctions = {};
const remoteSymbols = {};

let globalSymbol = Symbol();

const localVariable = 123;
const remoteObject = {
	fieldA: 'a',
	fieldB: 1,
	fieldC: /\d+/,
	booleanTrue: true,
	booleanFalse: false,
	undefinedObj: undefined,
	dateField: new Date(),
	bigIntField: 2n ** 53n,
    symbolField: globalSymbol,
    callbackCaller: (cb) => {
        cb("foo","bar",123);
    },
	arrayObj: [1,2,3,4,"foo",{"obj":"innerObj"},() => {
		console.log("someone from the outside is calling me");
	}],
	nullField: null,
	someNestedObject: {
		foo: "bar",
		baz: "qux",
		someNestedMethod: (value) => value*value
	},
	symbolCheck: (value) => {
		return globalSymbol === value
	},
	someMethod: (value) => {
		return localVariable + value
	},
	someMethodReturningAFunction: () => {
		return function (value) {
			return {
				value: 3*value,
				timestamp: new Date()
			}
		};
	}
}

registerObject("remoteObject", remoteObject);

function registerObject(objectName, object) {
	objects[objectName] = object;
}

function handleDisposeObject(connection, parsedObj) {
	if(!parsedObj.params.objectName || typeof parsedObj.params.objectName !== "string") {
		connection.sendUTF(generateInvalidParamsReponse());
	}
	else {
		let objectName = parsedObj.params.objectName;
		if(objectName) {
			if(remoteObjects[objectName]) {
				let boundFunctions = Object.keys(remoteObjects[objectName].functions);
				for(var i in boundFunctions) {
					delete remoteFunctions[boundFunctions[i]];
				}
				let boundSymbols = Object.keys(remoteObjects[objectName].symbols);
				for(var i in boundSymbols) {
					delete remoteSymbols[boundSymbols[i]];
				}
				delete remoteObjects[objectName];
			}
			connection.sendUTF(generateDisposeFunctionResponse(parsedObj.id, objectName));
		}
		else {
			connection.sendUTF(generateInvalidParamsReponse());
		}
	}
}

function handleDisposeFunction(connection, parsedObj) {
	if(!parsedObj.params.functionId || typeof parsedObj.params.functionId !== "string") {
		connection.sendUTF(generateInvalidParamsReponse());
	}
	else {
		let functionId = parsedObj.params.functionId;
		let remoteObjectName = remoteFunctions[functionId];
		if(remoteObjectName && remoteObjects[remoteObjectName].functions[functionId]) {
			delete remoteObjects[remoteObjectName].functions[functionId];
			delete remoteFunctions[functionId];
			connection.sendUTF(generateDisposeFunctionResponse(parsedObj.id, functionId));
		}
		else {
			connection.sendUTF(generateInvalidParamsReponse());
		}
	}
}

function handleGetRemoteObject(connection, parsedObj) {
	if(!parsedObj.params.objectName || typeof parsedObj.params.objectName !== "string") {
		connection.sendUTF(generateInvalidParamsReponse());
	}
	else {
		connection.sendUTF(generateGetRemoteObjectResponse(
			parsedObj.id,
			generateRemoteObject(objects[parsedObj.params.objectName], parsedObj.params.objectName),
			parsedObj.params.objectName
			));
	}
}

function handleCallRemoteFunction(connection, parsedObj) {
	if(!parsedObj.params.callingId || typeof parsedObj.params.callingId !== "string" || !remoteFunctions[parsedObj.params.callingId]) {
		connection.sendUTF(generateInvalidParamsReponse());
	}
	else {
		let ownerObjectName = remoteFunctions[parsedObj.params.callingId];
		let functionResults = remoteObjects[ownerObjectName].functions[parsedObj.params.callingId](...parsedObj.params.args);
		let generatedObject = generateRemoteObject({functionResults}, parsedObj.params.callingId);
		connection.sendUTF(generateCallRemoteFunctionResponse(parsedObj.id, generatedObject));
	}
}

function generateRemoteObject(obj, objectName) {
	let sentObject = {};
	let objKeys = Object.keys(obj);
	for(var i in objKeys) {
		let currentKey = objKeys[i];
		sentObject[currentKey] = generateSubObject(obj[currentKey], currentKey, objectName)
	}
	return JSON.stringify(sentObject);
}

function generateSubObject(subObject, currentKey, objectName) {
	let type = typeof subObject;
	switch(type) {
		case "number":
			return {
				type: "number",
				result: subObject
			}
		case "string":
			return {
				type: "string",
				result: subObject
			}
		case "boolean":
			return {
				type: "boolean",
				result: subObject
			}
		case "undefined":
			return {
				type: "undefined"
			}
		case "bigint":
			return {
				type: "bigint",
				result: subObject.toString()
			}
		case "object":
			if(subObject instanceof RegExp) {
				return {
					type: "regexp",
					result: subObject.toString()
				}
			}
			else if(subObject instanceof Date) {
				return {
					type: "date",
					result: subObject.toString()
				}
			}
			else if(subObject === null) {
				return {
					type: "null"
				}
			}
			else if(Array.isArray(subObject)) {
				return {
					type: "array",
					result: subObject.map((x) => {
						return generateSubObject(x, currentKey, objectName);
					})
				}
			}
			else {
				return {
					type: "object",
					result: generateRemoteObject(subObject, objectName)
				}
			}
			
		case "function":
			let functionId = uuid();
			if(!remoteObjects[objectName]) {
				remoteObjects[objectName] = {
					functions: {},
					symbols: {}
				}
			}
			remoteObjects[objectName].functions[functionId] = subObject;
			remoteFunctions[functionId] = objectName;
			return {
				type: "function",
				functionName: currentKey,
				callingId: functionId
			}
		case "symbol":
			let symbolId = uuid();
			if(!remoteObjects[objectName]) {
				remoteObjects[objectName] = {
					functions: {},
					symbols: {}
				}
			}
			remoteObjects[objectName].symbols[symbolId] = subObject;
			remoteSymbols[symbolId] = objectName;
			return {
				type: "symbol",
				symbolId
			}
		
	}
}

function validateAndParseRequest(incomingRPCRequest, connection) {
	let parsed = JSON.parse(incomingRPCRequest);
	if(parsed.jsonrpc && parsed.jsonrpc === "2.0" && parsed.id && parsed.method && typeof parsed.method === "string" && parsed.params) {
		if(parsed.params.args) {
			parsed.params.args = parsed.params.args.map(x => {
				if(typeof x === "string") {
                    let symbolMatcher = /^Symbol\((.*)\)/;
                    let callbackMatcher = /^CallbackFunction\((.*)\)/;
                    let symbolTestResult = x.match(symbolMatcher);
                    let callbackTestResult = x.match(callbackMatcher);
					if(symbolTestResult && symbolTestResult[1]) {
						return remoteObjects[remoteSymbols[symbolTestResult[1]]].symbols[symbolTestResult[1]] || x;
                    }
                    if(callbackTestResult && callbackTestResult[1]) {
                        return (...args) => {
                            let generatedObjectId = uuid();
                            let generatedObject = generateRemoteObject({callbackParams:args}, generatedObjectId);
                            connection.sendUTF(generateCallRemoteCallback(callbackTestResult[1], generatedObject, generatedObjectId));
                        }
                    }
				}
				return x;
			});
		}
		return parsed;
	}
	else {
		throw new Error("Invalid JSONRPC request");
	}
}

module.exports = {
    handleGetRemoteObject,
	handleCallRemoteFunction,
	handleDisposeFunction,
    handleDisposeObject,
    validateAndParseRequest
}