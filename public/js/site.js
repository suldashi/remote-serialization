var loc = window.location, new_uri;
if (loc.protocol === "https:") {
    new_uri = "wss:";
} else {
    new_uri = "ws:";
}
new_uri += "//" + loc.host;
new_uri += loc.pathname + "/ws";

let ws = new WebSocket(new_uri);

let wsRequests = {};
let remoteFunctions = {};
let remoteObjects = {};
let remoteCallbacks = {};
let currentMessageId = 1;
let currentCallbackId = 1;

ws.onmessage = (ev) => {
    let parsed = JSON.parse(ev.data);
    if(parsed.error) {
        console.error(parsed.error);
    }
    else {
        if(!parsed.id) {
            if(parsed.result.rpcName === "callRemoteCallback") {
                let parsedParams = JSON.parse(parsed.result.params);
                let paramArray = parseSubObject(parsedParams.callbackParams);
                if(remoteCallbacks[parsed.result.callbackId]) {
                    remoteCallbacks[parsed.result.callbackId](...paramArray);
                }
            }
        }
        else {
            let promiseHandler = wsRequests[parsed.id];
            if(promiseHandler) {
                delete wsRequests[parsed.id];
                if(parsed.result.rpcName === "getRemoteObject") {
                    let parsedResponse = JSON.parse(parsed.result.result);
                    let remoteObject = parseRemoteObject(parsedResponse);
                    remoteObjects[parsed.result.objectName] = remoteObject;
                    promiseHandler.resolve(remoteObject);
                }
                else if(parsed.result.rpcName === "callRemoteFunction") {
                    let functionResult = parseSubObject(JSON.parse(parsed.result.functionResult).functionResults);
                    promiseHandler.resolve(functionResult);
                }
                else if(parsed.result.rpcName === "disposeFunction") {
                    let callResult = parsed.result.disposed;
                    if(callResult) {
                        delete remoteFunctions[callResult];
                    }
                    promiseHandler.resolve(callResult);
                }
                else if(parsed.result.rpcName === "disposeObject") {
                    let callResult = parsed.result.disposed;
                    if(callResult) {
                        delete remoteObjects[callResult];
                    }
                    promiseHandler.resolve(callResult);
                }
            }
        }
    }
}

function parseRemoteObject(remoteObj) {
    let remoteObject = {};
    let objKeys = Object.keys(remoteObj);
    for(var i in objKeys) {
        let currentKey = objKeys[i];
        remoteObject[currentKey] = parseSubObject(remoteObj[currentKey]);
    }
    return remoteObject;
}

function parseSubObject(subObject) {
    let type = subObject.type;
        switch(type) {
            case "number":
                return parseFloat(subObject.result)
            case "string":
                return subObject.result
            case "boolean":
                return subObject.result
            case "object":
                return parseRemoteObject(JSON.parse(subObject.result))
            case "regexp":
                let regExpValue = subObject.result;
                let trimmed = regExpValue.substr(1, regExpValue.length-2);
                return new RegExp(trimmed);
            case "date":
                return new Date(subObject.result);
            case "undefined": {
                return undefined;
            }
            case "bigint": {
                return BigInt(subObject.result);
            }
            case "null": {
                return null;
            }
            case "array": {
                return subObject.result.map(parseSubObject)
            }
            case "function":
                let fn = (...args) => {
                    return callRemoteFunction(subObject.callingId, args);
                }
                remoteFunctions[subObject.callingId] = fn;
                return fn;
            case "symbol":
                return Symbol(subObject.symbolId);
        }
}

function disposeObject(obj) {
    let objectName = Object.keys(remoteObjects).find(x => remoteObjects[x] === obj);
    if(objectName) {
        return callDisposeObject(objectName);
    }
    else {
        throw new Error("Cannot dispose: not bound to remote object")
    }
}

function callDisposeObject(objectName) {
    let outerResolve;
    let outerReject;
    let prm = new Promise((resolve, reject) => {
        outerResolve = resolve;
        outerReject = reject;
        ws.send(JSON.stringify({
            jsonrpc: "2.0",
            method: "disposeObject",
            id: currentMessageId,
            params: {
                objectName
            }
        }));
    });
    wsRequests[currentMessageId++] = {
        prm,
        resolve: outerResolve,
        reject: outerReject,
    }
    return prm;
}

function disposeFunction(fn) {
    let functionId = Object.keys(remoteFunctions).find(x => remoteFunctions[x] === fn);
    if(functionId) {
        return callDisposeFunction(functionId);
    }
    else {
        throw new Error("Cannot dispose: not bound to remote function")
    }
}

function callDisposeFunction(functionId) {
    let outerResolve;
    let outerReject;
    let prm = new Promise((resolve, reject) => {
        outerResolve = resolve;
        outerReject = reject;
        ws.send(JSON.stringify({
            jsonrpc: "2.0",
            method: "disposeFunction",
            id: currentMessageId,
            params: {
                functionId
            }
        }));
    });
    wsRequests[currentMessageId++] = {
        prm,
        resolve: outerResolve,
        reject: outerReject,
    }
    return prm;
}

function callRemoteFunction(callingId, args) {
    if(!args) {
        args = [];
    }
    args = args.map(x =>
        {
            if(typeof x === "symbol") {
                return x.toString();
            }
            else if(typeof x === "function") {
                remoteCallbacks[currentCallbackId] = x;
                return `CallbackFunction(${currentCallbackId++})`;
            }
            else {
                return x;
            }
        });
    let outerResolve;
    let outerReject;
    let prm = new Promise((resolve, reject) => {
        outerResolve = resolve;
        outerReject = reject;
        ws.send(JSON.stringify({
            jsonrpc: "2.0",
            method: "callRemoteFunction",
            id: currentMessageId,
            params: {
                callingId,
                args
            }
        }));
    });
    wsRequests[currentMessageId++] = {
        prm,
        resolve: outerResolve,
        reject: outerReject,
    }
    return prm;
}

function getRemoteObject(objectName) {
    let outerResolve;
    let outerReject;
    let prm = new Promise((resolve, reject) => {
        outerResolve = resolve;
        outerReject = reject;
        ws.send(JSON.stringify({
            jsonrpc: "2.0",
            method: "getRemoteObject",
            id: currentMessageId,
            params: {
                objectName
            }
        }));
    });
    wsRequests[currentMessageId++] = {
        prm,
        resolve: outerResolve,
        reject: outerReject,
    }
    return prm;
}