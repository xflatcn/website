var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var CmsApi = require('./api/CmsApi');
var index = require('./routes/index');
var users = require('./routes/users');
var session = require('express-session');
var proxyHandler = require('./handlers/ProxyHandler');
var app = express();

// view engine setup
app.engine('html', require('ejs').renderFile);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(session({secret: 'keyboard cat', saveUninitialized: true,resave: true, cookie: {}}));
//rmi代理(代理应该在bodyParser之前)
app.use(proxyHandler());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);

app.get('*.html', function(req, res) {
  var url = req.url, len = url.length,
      path = url.substring(1, len-5);
  console.info(">>>path: " + path);

  if(url.indexOf("product_question")!=-1){
      var offset=0,total=10,page_num=1;
      var data=req.query;
      if(data.page_num!=null)
        page_num=data.page_num;
      if(page_num!=null&&page_num>1)
        offset=(page_num-1)*total;

      var questions=[];
      CmsApi.findContents("4360c005-fa0b-4ab3-8ba2-2ff433d38613", "support/faq", offset, total, function(result){
          //根据总条数计算分几页
          var totalData=result.totalRecords;
          totalData = parseInt(totalData);
          var pagenum=parseInt(total);
          var page_count=totalData/pagenum;
          var yu=(totalData%pagenum);
          if(yu!==0)
            page_count=parseInt(page_count)+1;

          var pagedata={page_num:page_num,page_count:page_count,datatotal:totalData};

          var list=result.list;
          for(var i in list){
              var item=list[i];
              var d = new Date(item.release_date);
              var month=d.getMonth()+1;
              if(month<10)
                month='0'+month;

              /*var day=d.getDate();
              if(day<10)
                  day='0'+month;
                  */

              var returnData=d.getFullYear() + '-' + month + '-' + d.getDate();
              item.dateTime=returnData;
              questions.push(item);
          }
          //res.send({questions:questions});
          res.render('product_question', {questions:questions,pagedata:pagedata});
      });
  }else if(url.indexOf("question_detail")!=-1){
      var id;
      var data=req.query;
      if(data.id!=null){
          CmsApi.findContent(data.id, function(result){
              res.render('question_detail', {data:result});
          });
      }
  }else if(url.indexOf("cust_message")!=-1){
      res.render('cust_message', {data:""});
  }else
    res.render(path, {title: 'We are the world!'});
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
