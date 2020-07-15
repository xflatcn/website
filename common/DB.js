var mysql = require('mysql');
var config = require("./config");

// 使用DBConfig.js的配置信息创建一个MySQL连接池
var dbPool = mysql.createPool(config.dbConf);

exports.query = function(sql, params, callback) {
    // 从连接池获取连接
    dbPool.getConnection(function (err, conn) {
        conn.query(sql, params, function(err, results, fields) {
            callback(err, results, fields);
            conn.release();
        })
    });
};

exports.limitQuery = function(sqlObj, params, offset, rows, callback) {
    // 从连接池获取连接
    dbPool.getConnection(function (err, conn) {

        if (err) throw err;

        //1. 查询总记录数
        var countSql = "select count(1) count " + sqlObj.from + " " + sqlObj.where;
        conn.query(countSql, params, function(err, result, fields) {

            if (err) throw err;

            console.info(">>>result: ");
            console.info(result[0].count);

            var count = result[0].count;

            //2. 查询列表
            if (count > 0) {
                var sql = sqlObj.select + " " + sqlObj.from + " " + sqlObj.where + " limit ?, ?";
                params.push(offset);
                params.push(rows);

                console.info(params);

                conn.query(sql, params, function (err, list, fields) {
                    console.info(">>>list result: ");
                    console.info(list);
                    callback(err, {list: list, totalRecords: result[0].count}, fields);
                    conn.release();
                });
            } else {
                callback(err, {list: [], totalRecords: 0}, fields);
                conn.release();
            }
        });
    });
};


