var http = require('http');
var qs = require("querystring");
var URL = require("url");
var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;

var MD5 = require("../common/md5.js");
var DB = require('../common/DB');
var conf = require("../common/config.js");

//存放已登录的用户信息，以sessionId作为key, 第三方服务通过该变量验证客户端是否已经登录过
var loginUsers = {};

var valid_user = function(val){
    //return !/[^\w_\-^!]/.test(val);
    //直接返回true，否则会导致邮箱用户无法登录(lgh 2016-04-25)
    return true;
};

var valid_mail =  function(val) {
    var filter = /^([\w]+(?:\.[\w]+)*)@((?:[\w]+\.)*\w[\w]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
    return filter.test(val);
};


//按照jsonp的方式输出到前端
function outJsonp(res, json, jsoncallback) {
    if (jsoncallback) {
        res.end(jsoncallback+"("+ JSON.stringify(json) +");");
    } else {
        res.end(JSON.stringify(json));
    }
}

//页面输出
function outHtml(req, res, msg) {
    var username = req.body.username || req.query.username;
    if(req.session.li && req.session.li.indexOf('login_result') > 0){
        res.redirect(req.session.li + '?err=' + encodeURIComponent(msg));
    } else {
        res.render("login",{errMsg: msg, username: username});
    }
}

function getS(k,callback){
    var s = conf.get("secret_" + k);
    if(s){
        if(s == 'none'){
            callback();
        } else {
            callback(s);
        }
        return;
    }
    DB.query("select code,password,pp from biz_user o where o.code = ?", [k],
        function(err, results, fields) {
            if(err){
                throw err;
            }
            if(results.length == 0) {
                conf.set("secret_" + k,"none");
                callback();
            } else {
                conf.set("secret_" + k,results[0].pp);
                callback(results[0].pp);
            }
        }
    );
}

//only call when back
function build_back(req){
    var t = "" + new Date().getTime();
    var d = null;
    if(req.session.k){
        var cmd5 = crypto.createHash('md5');
        cmd5.update(req.session.k);
        console.info(">>>>>>>sss: " + req.session.s);
        cmd5.update(req.session.s);
        cmd5.update(t);
        cmd5.update(req.session.user.code);
        d = cmd5.digest('hex');
        console.info(">>>>>>>>>>>>cmd5 result: " + d);
    }

    var li = req.session.li;

    if(!li){
        li = "http://www.app365.com";
    }

    var param = {username: req.session.user.code, loginId: req.sessionID};

    if (d) {
        param.t = t;
        param.d = d;
        param.k = req.session.k;
    }

    if(li.indexOf('?') != -1){
        li = li + "&app365=" + encodeURIComponent(qs.stringify(param));
    } else {
        li = li + "?app365=" + encodeURIComponent(qs.stringify(param));
    }

    var app = {
        lo: req.session.lo,
        li: req.session.li,
        k: req.session.k,
        s: req.session.s,
        username : req.session.user.code
    };

    if (!req.session.apps) {
        req.session.apps = [app];
    } else {
        req.session.apps.push(app);
    }

    loginUsers[req.sessionID] = req.session.apps;

    console.log("back li:" + li);

    return li;
}


var logoutRequest = function(app){

    var p = URL.parse(app.lo);
    var path = p.pathname?(p.pathname + (p.search?p.search:'')):'/';
    var param = {username:app.username};
    var t = "" + new Date().getTime();
    var d = null;
    if(app.k){
        var cmd5 = crypto.createHash('md5');
        cmd5.update(app.k);
        cmd5.update(app.s);
        cmd5.update(t);
        cmd5.update(app.username);
        d = cmd5.digest('hex');
    }

    if(d){
        param.t = t;
        param.k = app.k;
        param.d = d;
    }

    if(path.indexOf('?') != -1){
        path = path + "&app365_logout=" + encodeURIComponent(qs.stringify(param));
    } else {
        path = path + "?app365_logout=" + encodeURIComponent(qs.stringify(param));
    }

    var options = {
        host: p.hostname,
        port: (p.port?parseInt(p.port):80),
        path: path,
        method: 'GET'
    };

    //如果对方有心返回很多东西，进行攻击的，咋办啊
    var req = http.request(options, function(res) {
        console.log(options.host +  "--->" + options.port + "--->" + options.path + "--->" + res.statusCode);
    });
    req.end();
};

var eventEmitter = new EventEmitter();
eventEmitter.on('logout',function(apps){
    if(!apps)
        return;
    for(var i = 0 ; i < apps.length ; i ++ ){
        if(apps[i].lo)
            logoutRequest(apps[i]);
    }
});

var UserApi = {
    //only get login,sigup
    parseReq: function(req) {
        var ps = URL.parse(req.url,true).query;
        if(ps.li || ps.ref){
            req.session.li = ps.li?ps.li:ps.ref;
            if(ps.lo){
                req.session.lo = ps.lo;
            } else {
                req.session.lo = null;
            }
            if(ps.k){
                req.session.k = ps.k;
            } else {
                req.session.k = null;
            }
            console.log("when in li :" + req.session.li + " " + req.session.lo + " "  + req.session.k);
        }
    },
    //返回初始进入的页面
    returnBack: function(req, res) {
        if('close' == req.session.li){
            res.end("<html><head><script type='text/javascript'>" +
                "window.onload = function(){window.close();}" +
                "</script></head><body></body></html>");
            return;
        }
        if(req.session.k){
            console.info(">>>req.session.k to redirect....");
            getS(req.session.k, function(s){
                req.session.s = s;
                res.redirect(build_back(req));
                delete req.session.li;
                delete req.session.lo;
                delete req.session.k;
                delete req.session.s;
            });
        } else {
            console.info(">>>no req.session.k to redirect....");
            res.redirect(build_back(req));
            delete req.session.li;
            delete req.session.lo;
            delete req.session.k;
            delete req.session.s;
        }
    },
    //登录操作
    doLogin: function(req, res, forAjax) {
        console.info(">>>call UserApi.doLogin...");

        UserApi.parseReq(req);

        var username = req.body.username || req.query.username;
        var password = req.body.password || req.query.password;
        var json = {};
        var jsoncallback = req.query.jsoncallback;

        if(!username || !password){
            if (forAjax) {
                json = {message:"请输入你的用户名称和密码", username: username, status: 'Error'};
                outJsonp(res, json, jsoncallback);
            } else {
                outHtml(req, res, "请输入你的用户名称和密码");
            }
            return;
        }

        if(!valid_user(username)){
            if (forAjax) {
                json = {message: "请输入正确的用户名", username: username, status: 'Error'};
                outJsonp(res, json, jsoncallback);
            } else {
                outHtml(req, res, "请输入正确的用户名");
            }
            return;
        }

        DB.query("select o.* from biz_user o where o.code=?", [username], function(err, results, fields){
            //查询出错
            if (err) {
                if (forAjax) {
                    json = {message:"查询数据发生错误", code: code, status: 'Error'};
                    outJsonp(res, json, jsoncallback);
                    return;
                } else {
                    throw err;
                }
            }

            //不存在该用户
            if(results.length == 0){
                if (forAjax) {
                    json = {message:"用户名或者密码错误", code: code, status: 'Error'};
                    outJsonp(res, json, jsoncallback);
                } else {
                    outHtml(req, res, "用户名或者密码错误");
                }
                return;
            }

            //存在多个用户
            if(results.length > 1){
                if (forAjax) {
                    json = {message:"用户名重复了", code: code, status: 'Error'};
                    outJsonp(res, json, jsoncallback);
                    return;
                } else {
                    if(req.session.li && req.session.li.indexOf('login_result') > 0){
                        res.redirect(req.session.li + '?err=' + encodeURIComponent(username + ' 用户名重复了!'));
                    } else {
                        throw new Error(username + ' 用户名重复了!');
                    }
                }
            }

            var user = results[0];

            //well,login
            console.info(">>>>" + MD5.hex_md5(password) + "," + user.password);

            //成功匹配
            if(MD5.hex_md5(password) == user.password) {//启用加密
                req.session.user = user;
                if (forAjax) {
                    outJsonp(res, {message:"您已成功登录", username: username, status: 'Success'}, jsoncallback);
                } else {
                    UserApi.returnBack(req,res);
                }
            } else {
                if (forAjax) {
                    json = {message:"用户名或者密码错误", username: username, status: 'Error'};
                    outJsonp(res, json, jsoncallback);
                    return;
                } else {
                    outHtml(req, res, "用户名或者密码错误");
                    return;
                }
            }
        });
    },
    doLogout: function (req, res) {
        var o = URL.parse(req.url,true).query.o;
        //already login
        if(req.session.user){
            delete req.session.user;
            delete req.session.los;
            delete req.session.li;
            delete req.session.lo;
            eventEmitter.emit('logout', req.session.apps);
            delete req.session.apps;
        }
        o = o ? o:'http://www.app365.com';
        res.redirect(o);
    },
    getStatus: function (req, res) {
        var json = {};
        var url  = URL.parse(req.url);
        var path = url.pathname;
        json.script_id = req.query.script_id;
        var jsoncallback=req.query.jsoncallback;
        console.info(req.query);
        if(req.session.user){
            json.app365 = qs.stringify({username: req.session.user.code});
        }
        outJsonp(res, json, jsoncallback);
    }
};

module.exports = UserApi;