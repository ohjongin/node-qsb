'use strict'
/**
 https://luckyyowu.tistory.com/345
 https://github.com/uyu423/node-qsb
*/
const app_root = require('app-root-path');
const tracer = require('tracer');
const process = require('process');

// noinspection DuplicatedCode
const logger = tracer.dailyfile({
    root: `${app_root}/logs`,
    splitFormat: `yyyymmdd${process.env.pm_id ? ('.' + process.env.pm_id) : ''}`,
    allLogsFileName: 'sql',
    preprocess: function(data) {
        let pmId = process.env.pm_id;
        if (!pmId) pmId = "";
        else pmId += ":"
        data.title = `${pmId}${process.pid}:${data.title.toUpperCase()}`;
    },
    transport: function(data) {
        let isProd = process.env.NODE_ENV && process.env.NODE_ENV.toLocaleLowerCase().includes('prod')
            || process.env.ENV_TYPE && process.env.ENV_TYPE.toLocaleLowerCase().includes('prod');
        if (isProd) {
            return;
        }
        console.log(data.output);
    },
    format: "{{timestamp}} <{{title}}> {{file}}:{{line}} ({{method}}) {{message}}",
    dateformat: "isoDateTime",
    stackIndex: 1
});

// add Back Quote
function bq(value) {
    if (value === undefined || value === null) return null;

    if (value.includes('.')) {
        value = value.split('.');
        return "`" + value[0] + "`.`" + value[1] + "`";
    }

    return (value.includes('(') || value.includes('%')) ? value : "`" + value + "`";
}

function esc(value) {
    if (value === '?') return value;
    else if (value === undefined || value === null) return null;

    if (typeof value === 'boolean') return value;
    else if (typeof value !== "string") value = "" + value;

    value = value.replace(/[\0\n\r\b\t\\'"\x1a]/g, function (res) {
        switch (res) {
            case "\0":
                return "\\0";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\b":
                return "\\b";
            case "\t":
                return "\\t";
            case "\x1a":
                return "\\Z";
            default:
                return "\\" + res;
        }
    });
    return `'${value}'`; // "'" + value + "'";
}	//apply Esapce Character

function hasFunction(str) {
    if (typeof str !== 'string') return false;

    return str.endsWith(')');
}

function format(value) {
    if (value instanceof Date) {
        value = value.toISOString().replace('T', ' ').split('.')[0];
        value = "STR_TO_DATE(" + esc(value) + ", " + "'%Y-%m-%d %H:%i:%s')";
    } else if (['true', 'false'].includes(value)) {
        value = value === 'true';
    }

    return hasFunction(value) ? value : esc(value)
}

module.exports = function () {
    this._comm = "";
    this._get = "";
    this._cols = "";
    this._values = "";
    this._set = "";
    this._from = "";
    this._join = "";
    this._where = "";
    this._upsert = "";
    this._ignore = "";
    this._limit = "";
    this._order = "";
    this._group = "";
    this._qs = "SELECT 'QUERY NOT BUILD'";
};

module.exports.prototype.forceQuery = function (query) {
    this._qs = query;
    return this;
};

module.exports.prototype.selectAll = function (from, short) {
    if (this._from.length !== 0) {
        this._from += ", ";
    }
    if (this._from.length === 0) {
        this._from = " FROM ";
    }
    this._comm = "SELECT ";
    this._from += bq(from);
    if (short !== undefined) {
        this._from += " " + bq(short);
    }
    return this;
};

module.exports.prototype.select = function (columns) {
    this._comm = "SELECT ";

    if (Array.isArray(columns)) {
        for (let col of columns) {
            this.get(col);
        }
    } else if (!columns) {
        this._get = "*";
    } else if (typeof columns === 'string') {
        this._get = columns;
    }

    return this;
};

module.exports.prototype.update = function (table) {
    this._comm = "UPDATE ";
    this._from = bq(table);
    return this;
};

module.exports.prototype.insert = function (table) {
    this._comm = "INSERT ";
    if (table) this._from = "INTO " + bq(table);
    return this;
};

module.exports.prototype.delete = function (table) {
    this._comm = "DELETE ";
    this._from = "FROM " + bq(table);
    return this;
};

module.exports.prototype.ignore = function () {
    this._ignore = "IGNORE ";
    return this;
};

module.exports.prototype.into = function (table) {
    this._from = "INTO " + bq(table);
    return this;
};

module.exports.prototype.from = function (from, short) {
    if (this._from.length !== 0) {
        this._from += ", ";
    }
    if (this._from.length === 0) {
        this._from = " FROM ";
    }
    this._from += bq(from);
    if (short !== undefined) {
        this._from += " " + bq(short);
    }
    return this;
};

module.exports.prototype.join = function (table, short) {
    this._join += " JOIN " + bq(table);
    if (short !== undefined) {
        this._join += " " + bq(short);
    }
    return this;
};

module.exports.prototype.on = function (a, b, c) {
    if (this._on.length !== 0) {
        this._on += " AND ";
    }
    if (this._on.length === 0) {
        this._on += " ON ";
    }
    this._on += esc(a) + " " + esc(b) + " " + esc(c);
    return this;
};

module.exports.prototype.values = function (cols, values) {
    let i;
    switch (this._comm.trim()) {
        case 'UPDATE':
            if (Array.isArray(cols)) {
                for (i = 0; i < cols.length; i++) {
                    if (cols[i] === undefined) throw new Error(`Column name is undefined! ${JSON.stringify(cols)}`)
                    let value = Array.isArray(values) ? values[i] : '?'
                    this.set(cols[i], value);
                }
            }
            break;
        case 'INSERT':
        default:
            this._cols += "(";
            for (i = 0; i < cols.length; i++) {
                if (cols[i] === undefined) throw new Error(`Column name is undefined! ${JSON.stringify(cols)}`)
                this._cols += bq(cols[i]);
                if (i < cols.length - 1) {
                    this._cols += ", ";
                }
            }
            this._cols += ")";
            if (values) {
                this._values += " VALUES (";
                for (i = 0; i < values.length; i++) {
                    // value에 '?' 값이 있으면 format->esc를 거치면서 quote가 사라지는 현상 방어코드
                    if (values[i] === '?') {
                        this._values += `'${values[i]}'`;
                    } else {
                        this._values += format(values[i]);
                    }

                    if (i < values.length - 1) {
                        this._values += ", ";
                    }
                }
                this._values += ")";
            } else {
                this._values = " VALUES ?"
            }
            break;
    }

    return this;
};

module.exports.prototype.addValues = function (values) {
    this._values += ",(";
    for (let i = 0; i < values.length; i++) {
        this._values += esc(values[i]);
        if (i < values.length - 1) {
            this._values += ",";
        }
    }
    this._values += ")";
    return this;
};

module.exports.prototype.get = function (get) {
    if (this._get.length !== 0) {
        if (this._get === '*') this._get = "";
        else this._get += ",";
    }
    this._get += bq(get);
    return this;
};

module.exports.prototype.set = function (col, value) {
    if (this._set.length !== 0) {
        this._set += ",";
    }
    if (this._set.length === 0) {
        this._set += " SET ";
    }

    if (value === null || value === undefined) {
        if (Array.isArray(col)) {
            for (let c of col) {
                this._set += bq(c) + '=' + '?,';
            }
            this._set += ';'
            this._set = this._set.replace(',;', '');
        } else this._set += bq(col) + "=" + 'null';
    } else if (value && typeof value.getMonth === 'function') {
        this._set += bq(col) + "=" + esc(value.toJSON().slice(0, 19).replace('T', ' '));
    } else {
        this._set += bq(col) + "=" + esc(value);
    }

    return this;
};

module.exports.prototype.setValues = function (cols, values) {
    for (let i = 0; i < cols.length; i++) {
        let set = cols[i];
        let value = values[i];
        if (this._set.length !== 0) {
            this._set += ",";
        }
        if (this._set.length === 0) {
            this._set += " SET ";
        }
        this._set += bq(set) + " = " + esc(value);
    }
    return this;
};

module.exports.prototype.where = function (left, op, right) {
    let result;

    if (this._where.length !== 0) {
        this._where += " AND ";
    }

    if (this._where.length === 0) {
        this._where += " WHERE ";
    }

    if (Array.isArray(right)) {
        result = '(';
        for (let item of right) {
            result += esc(item);
        }
        result += ')'
    } else if (op === 'is') {
        result = right
    } else if (hasFunction(right)) {
        result = right;
    } else {
        result = esc(right)
    }

    this._where += bq(left) + " " + op + " " + result;
    return this;
};

module.exports.prototype.whereOr = function (left, op, right) {
    if (this._where.length !== 0) {
        this._where += " OR ";
    }
    if (this._where.length === 0) {
        this._where += " WHERE ";
    }
    this._where += bq(left) + " " + op + " " + esc(right);
    return this;
};

module.exports.prototype.onDuplicateKeyUpdate = function (cols, values, exclude) {
    if (this._upsert.length === 0) {
        this._upsert += " ON DUPLICATE KEY UPDATE ";
    }

    for (let i = 0; i < values.length; i++) {
        let col = cols[i];
        if (exclude.filter(e => e === col).length > 0) continue;

        let value = format(values[i])
        this._upsert += bq(cols[i]);
        this._upsert += '='
        this._upsert += value;
        this._upsert += ", "
    }
    this._upsert += ";"
    this._upsert = this._upsert.replace(', ;', '');
    return this;
};

module.exports.prototype.limit = function (offset, row_count) {
    if (this._limit.length === 0) {
        this._limit += " LIMIT ";
    }

    if (offset) this._limit += offset + ", "
    this._limit += row_count;
    return this;
};

module.exports.prototype.orderBy = function (col, sort) {
    if (this._order.length !== 0) {
        this._order += ", ";
    }
    if (this._order.length === 0) {
        this._order += " ORDER BY ";
    }
    this._order += bq(col) + " " + sort;
    return this;
};

module.exports.prototype.groupBy = function (col) {
    this._group += " GROUP BY " + bq(col);
    return this;
};

module.exports.prototype.build = function () {
    if (this._comm.trim() === "SELECT") {
        this._qs = this._comm + (this._get.length === 0 ? "*" : this._get) + this._from + this._join + this._where + this._order + this._group + this._limit + ";";
    }

    if (this._comm.trim() === "UPDATE") {
        this._qs = this._comm + this._from + this._set + this._where + ";";
    }

    if (this._comm.trim() === "INSERT") {
        this._qs = this._comm + this._ignore + this._from + ' ' + this._cols + this._values;
        if (this._upsert.length > 0) this._qs += (this._upsert + ";");
        else if (this._values.slice(-1) !== "?") this._qs+= ";";
    }

    if (this._comm.trim() === "DELETE") {
        this._qs = this._comm + this._from + this._where + ";";
    }

    return this;
};

module.exports.prototype.log = function (values) {
    logger.log(this._qs, values ? values : '');

    return this;
}

module.exports.prototype.printObject = function () {
    logger.log(this);
    return this;
};

module.exports.prototype.printString = function () {
    logger.log(this._qs);
    return this;
};

module.exports.prototype.toString = function () {
    return this._qs;
};
