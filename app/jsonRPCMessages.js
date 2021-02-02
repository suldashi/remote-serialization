function generateDisposeFunctionResponse(id, disposedId) {
	return JSON.stringify({
		jsonrpc: "2.0",
		result: {
			rpcName: "disposeFunction",
			disposed: disposedId
		},
		id
	})
}

function generateGetRemoteObjectResponse(id, result, objectName) {
	return JSON.stringify({
		jsonrpc: "2.0",
		result: {
			rpcName: "getRemoteObject",
			result,
			objectName
		},
		id
	})
}

function generateCallRemoteFunctionResponse(id, functionResult) {
	return JSON.stringify({
		jsonrpc: "2.0",
		result: {
			rpcName: "callRemoteFunction",
			functionResult
		},
		id
	})
}

function generateCallRemoteCallback(callbackId, params, generatedObjectId) {
	return JSON.stringify({
		jsonrpc: "2.0",
		result: {
			rpcName: "callRemoteCallback",
			callbackId,
			params,
			generatedObjectId
		}
	})
}

function generateErrorResponse(errorMessage) {
	return JSON.stringify({
		jsonrpc: "2.0",
		error: {
			code: -32700,
			message: errorMessage
		}
	})
}

function generateInvalidMethodResponse() {
	return JSON.stringify({
		jsonrpc: "2.0",
		error: {
			code: -32601,
			message: "Method not found"
		}
	})
}

function generateInvalidParamsReponse() {
	return JSON.stringify({
		jsonrpc: "2.0",
		error: {
			code: -32602,
			message: "Invalid params"
		}
	})
}



function generateCannotAcceptBinaryResponse() {
    return JSON.stringify({
        jsonrpc: "2.0",
        error: {
            code: -32600,
            message: "Cannot accept binary data."
        }
    })
}

module.exports = {
    generateDisposeFunctionResponse,
    generateGetRemoteObjectResponse,
    generateCallRemoteFunctionResponse,
    generateErrorResponse,
    generateInvalidMethodResponse,
    generateInvalidParamsReponse,
	generateCannotAcceptBinaryResponse,
	generateCallRemoteCallback
}