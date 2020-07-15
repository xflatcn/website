var httpProxy = require('http-proxy');
var proxyServer = httpProxy.createProxyServer({xfwd:true});
var config = require("../common/config");

var getContentType = function(ext){
    var contentType = '';
    switch(ext){
        case ".html":
            contentType= "text/html";
            break;
        case ".js":
            contentType="text/javascript";
            break;
        case ".css":
            contentType="text/css";
            break;
        case ".gif":
            contentType="image/gif";
            break;
        case ".jpg":
            contentType="image/jpeg";
            break;
        case ".png":
            contentType="image/png";
            break;
        case ".ico":
            contentType="image/icon";
            break;
        default:
            contentType="application/octet-stream";
    }

    return contentType;
};
var cookie  = "";

function proxyHandler() {
    proxyServer.on('proxyReq', function (proxyReq, req, res) {
        var addedCookie = (cookie ? cookie : req.session.bizCookie || '');
        console.info('>>>proxy aded cookie: ' + addedCookie);
        //req.headers.cookie = addedCookie + req.headers.cookie;
        proxyReq._headers = req.headers;
        /*if (req.body) {
            var bodyData = JSON.stringify(req.body);
            // incase if content-type is application/x-www-form-urlencoded -> we need to change to application/json
            proxyReq.setHeader('Content-Type', 'application/json')
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            // stream the content
            proxyReq.write(bodyData)
        }*/
        return req;
    });

    proxyServer.on('error', function (proxyReq, req, res) {
        res.send("<h1>404 Not Found</h1>");
    });

    proxyServer.on('proxyRes', function (proxyRes, req, res) {
        var JSESSIONID =  proxyRes.headers['set-cookie'];
        if(JSESSIONID){
            cookie = JSESSIONID;
            console.info(">>>proxy cookie: " + cookie);
            res.setHeader('Set-Cookie',cookie);
        }
    });
    return function (req, res, next) {
        console.info(">>>proxy handler!!!");
        var url = req.url;
        console.info(">>>url: " + url);
        if (url.startsWith("/bizweb")) {
            proxyServer.web(req, res, {target: config.proxy_host})
        } else if (url.startsWith("/site56")) {
            proxyServer.web(req, res, {target: "http://so56.app365.com:8190"})
        } else {
            next();
        }
    }
}

module.exports = proxyHandler;