'use strict';

const express = require("express");
const app = express();
const server = require("http").createServer(app);
const path = require("path");
const WebSocketServer = require('websocket').server;

const { 
	generateErrorResponse,
	generateInvalidMethodResponse,
	generateCannotAcceptBinaryResponse
 } = require("./jsonRPCMessages");

 const {
	handleGetRemoteObject,
	handleCallRemoteFunction,
	handleDisposeFunction,
	handleDisposeObject,
	validateAndParseRequest
 } = require("./wsHandler");

const port = 8080;

app.get("/ws", (req, res) => {
	res.send();
});

app.use('/public', express.static(path.resolve(__dirname,"..",'public')));

app.get("*",(req,res) => {
	res.sendFile(path.resolve("public/index.html"));
});

app.set("x-powered-by",false);

const wsServer = new WebSocketServer({
	httpServer: server,
	autoAcceptConnections: false
});

wsServer.on("request", (req) => {
	var connection = req.accept(null, req.origin);
	connection.on("message", (msg) => {
		if(msg.type === "utf8") {
			try {
				let parsed = validateAndParseRequest(msg.utf8Data, connection);
				switch(parsed.method) {
					case "getRemoteObject": 
						handleGetRemoteObject(connection, parsed);
						break;
					case "callRemoteFunction":
						handleCallRemoteFunction(connection, parsed);
						break;
					case "disposeFunction":
						handleDisposeFunction(connection, parsed);
						break;
					case "disposeObject":
						handleDisposeObject(connection, parsed);
						break;
					default: 
						connection.sendUTF(generateInvalidMethodResponse());
				}
			}
			catch(err) {
				connection.sendUTF(generateErrorResponse(err.message));
			}
			
		}
		else if (msg.type === "binary") {
			connection.sendUTF(generateCannotAcceptBinaryResponse());
		}
		else {
			console.log("unknown message type");
		}
	})
});

server.listen(port);
console.log("started on " + port);
