/**
 https://luckyyowu.tistory.com/345
 https://github.com/uyu423/node-qsb
*/
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

    // [22001][3140] Data truncation: Invalid JSON text: "Invalid encoding in string." at position 1225 in value for column 'scale_teams.payload'.
    // SQL문에 '\n'이 있으면 줄바꿈으로 인식해서 오류가 발생함
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

    return `'${value}'`;
}

function hasFunction(str) {
    if (typeof str !== 'string') return false;

    const matched = str.match(/^[A-Za-z0-9_\-\s]+[(][A-Za-z0-9'",_\-\s]+[)]/g);
    const found = (matched || []).length > 0;

    return str.endsWith(')') && found;
}

function format(value) {
    let result = value;

    if (value instanceof Date) {
        result = value.toISOString().slice(0, 19).replace('T', ' ');
    } else if (['true', 'false'].includes(value)) {
        result = value === 'true';
    }

    return hasFunction(result) ? result : esc(result)
}

export class QueryStringBuilder {
    _comm = "";
    _get = "";
    _cols = "";
    _values = "";
    _set = "";
    _from = "";
    _join = "";
    _where = "";
    _upsert = "";
    _ignore = "";
    _limit = "";
    _order = "";
    _group = "";
    _on = "";
    _qs = "SELECT 'QUERY NOT BUILD'";

    constructor() {
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
        this._on = "";
        this._qs = "SELECT 'QUERY NOT BUILD'";
    }

    forceQuery = (query: string): QueryStringBuilder  => {
        this._qs = query;
        return this;
    };

    selectAll = (from, short) => {
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

    select = (columns: string | string [] = undefined) => {
        this._comm = "SELECT ";

        if (Array.isArray(columns)) {
            for (const col of columns) {
                this.get(col);
            }
        } else if (!columns) {
            this._get = "*";
        } else if (typeof columns === 'string') {
            this._get = columns;
        }

        return this;
    };

    update = (table) => {
        this._comm = "UPDATE ";
        this._from = bq(table);
        return this;
    };

    insert = (table = undefined) => {
        this._comm = "INSERT ";
        if (table) this._from = "INTO " + bq(table);
        return this;
    };

    delete = (table = undefined) => {
        this._comm = "DELETE ";
        if (table) this._from = "FROM " + bq(table);
        return this;
    };

    ignore = () => {
        this._ignore = "IGNORE ";
        return this;
    };

    into = (table) => {
        this._from = "INTO " + bq(table);
        return this;
    };

    from = (from, short = undefined) => {
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

    join = (table, short) => {
        this._join += " JOIN " + bq(table);
        if (short !== undefined) {
            this._join += " " + bq(short);
        }
        return this;
    };

    on = (a, b, c) => {
        if (this._on.length !== 0) {
            this._on += " AND ";
        }
        if (this._on.length === 0) {
            this._on += " ON ";
        }
        this._on += esc(a) + " " + esc(b) + " " + esc(c);
        return this;
    };

    values = (cols, values = undefined) => {
        let i;
        switch (this._comm.trim()) {
            case 'UPDATE':
                if (Array.isArray(cols)) {
                    for (i = 0; i < cols.length; i++) {
                        if (cols[i] === undefined) throw new Error(`Column name is undefined! ${JSON.stringify(cols)}`)
                        const value = Array.isArray(values) ? values[i] : '?'
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

    addValues = (values) => {
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

    get = (get) => {
        if (this._get.length !== 0) {
            if (this._get === '*') this._get = "";
            else this._get += ",";
        }
        this._get += bq(get);
        return this;
    };

    set = (col, value = undefined) => {
        if (this._set.length !== 0) {
            this._set += ",";
        }
        if (this._set.length === 0) {
            this._set += " SET ";
        }

        if (value === null || value === undefined) {
            if (Array.isArray(col)) {
                for (const c of col) {
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

    setValues = (cols, values) => {
        for (let i = 0; i < cols.length; i++) {
            const set = cols[i];
            const value = values[i];
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

    where = (left, op, right) => {
        let result;

        if (this._where.length !== 0) {
            this._where += " AND ";
        }

        if (this._where.length === 0) {
            this._where += " WHERE ";
        }

        if (Array.isArray(right)) {
            result = '(';
            for (const item of right) {
                result += esc(item);
                result += ',';
            }
            result += ')';

            result = result.replace(',)', ')');
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

    whereOr = (left, op, right) => {
        if (this._where.length !== 0) {
            this._where += " OR ";
        }
        if (this._where.length === 0) {
            this._where += " WHERE ";
        }
        this._where += bq(left) + " " + op + " " + esc(right);
        return this;
    };

    onDuplicateKeyUpdate = (cols, values, exclude) => {
        if (this._upsert.length === 0) {
            this._upsert += " ON DUPLICATE KEY UPDATE ";
        }

        for (let i = 0; i < values.length; i++) {
            const col = cols[i];
            if (exclude && exclude.filter(e => e === col).length > 0) continue;

            const value = format(values[i])
            this._upsert += bq(cols[i]);
            this._upsert += '='
            this._upsert += value;
            this._upsert += ", "
        }
        this._upsert += ";"
        this._upsert = this._upsert.replace(', ;', '');
        return this;
    };

    limit = (offset, row_count) => {
        if (this._limit.length === 0) {
            this._limit += " LIMIT ";
        }

        if (offset) this._limit += offset + ", "
        this._limit += row_count;
        return this;
    };

    orderBy = (col, sort) => {
        if (this._order.length !== 0) {
            this._order += ", ";
        }
        if (this._order.length === 0) {
            this._order += " ORDER BY ";
        }
        this._order += bq(col) + " " + sort;
        return this;
    };

    groupBy = (col: string | string []) => {
        const columns = Array.isArray(col) ? col : [ col ];
        const value = columns.join(',')
        this._group += " GROUP BY " + value;
        return this;
    };

    log = (values = undefined) => {
        return this;
    }

    printObject = () => {
        return this;
    };

    printString = () => {
        return this;
    };

    toString = () => {
        return this._qs;
    };

    build = () => {
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
}
