
var DB = require('../common/DB');

var CmsApi = {
    findContents: function(client_id, pub_path, offset, rows, callback) {

        var sqlSelect = "SELECT o.id, o.title, o.release_date, DATE(o.release_date) date_str, " +
            "o.description, o.content_type, o.content_type_name, o.type_img, o.title_img",
            sqlFrom = "FROM cms_content o JOIN cms_channel c ON c.id=o.channel_id",
            sqlWhere = "WHERE o.client_id IN ('0',?)" +
                " AND c.pub_path=?" +
                " ORDER BY o.release_date DESC";

        DB.limitQuery({select: sqlSelect, from: sqlFrom, where: sqlWhere}, [client_id, pub_path], offset, rows,
            function(err, result, fields) {
                if (err) {
                    throw err;
                }
                console.info(result);
                callback(result);
            }
        );
    },
    findContent: function (id, callback) {
        var sql = "select o.* from cms_content o where o.id=?";
        DB.query(sql, [id], function(err, results, fields){
            if (err) throw err;
            console.info(results);
            if (results.length>0) {
                callback(results[0]);
            } else {
                callback(null);
            }
        });
    }
};

module.exports = CmsApi;