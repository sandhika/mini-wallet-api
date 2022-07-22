import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { uuid } from 'uuidv4';

const sqlite = require('better-sqlite3');
const path = require('path');
const db = new sqlite(path.resolve('db/core-litle.db'), {fileMustExist: true});

const app = express();
var accessTokenSecret = '6b3f7dc70abe8aed3e56658b86fa508b472bf238';
var custId = '';

app.use(cors());

var multer = require('multer');
var forms = multer();
app.use(express.urlencoded())
app.use(forms.array()); 



const authenticateAPIKey = (req, res, next) => {
    const authHeader = req.headers.authorization;
    //serviceCore.init();

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        
            if (token != accessTokenSecret) {
                return res.sendStatus(403);
            }

            req.user = 'success';
            next();
       
    } else {
        res.sendStatus(401);
    }
};



app.post('/api/v1/init', (req, res) => {
  try {
  
    var customerxid  = req.body.customer_xid;
    //ea0212d3-abd6-406f-8c67-868e814a2436
    //let result = serviceCore.init(customerxid);
    let newUuid = uuid();

    let strSQL = 'INSERT INTO custs (name,token, balance, isEnabled, createdAt, updatedAt) select @customerxid,@newUuid,0,0, date(),date() WHERE NOT EXISTS(SELECT 1 FROM custs WHERE name = @customerxid);';
    let params = {customerxid,newUuid};
    let result = db.prepare(strSQL).run(params);
    console.log(result);

    custId = customerxid;

     let resultJson = {
      "data": {
        "token": newUuid
      },
      "status": (result.changes>0?"success":"exists")
    };

    return res.send(resultJson);

      // lines of code
    } catch (e) {
      let resultJson = {
        "data": {
          "message": e
        },
        "status": "error"
      };
      return res.send(resultJson);

    }
  

  });

  
  //Enable my wallet
  app.post('/api/v1/wallet',authenticateAPIKey, (req, res) => {
    try {
    let strSQL = 'update custs set isEnabled = 1 where name = @custId;';
    let params = {custId};
    let resultUpdate = db.prepare(strSQL).run(params);
    console.log(resultUpdate);

    let strSQLSelect = 'select * from custs where name = @custId';
    //params = {custId};
    let result = db.prepare(strSQLSelect).all(params);
    console.log(result);
    let resultJSON = {
      "status":  (resultUpdate.changes>0?"success":"failed"),
      "data": {
        "wallet": {
          "id": result[0].name,          
          "status": (result[0].isEnabled>0?"enable":"disable"),
          "enabled_at": result[0].updatedAt,
          "balance": result[0].balance
        }
      } 
    }

    return res.send(resultJSON);

  } catch (e) {
    let resultJson = {
      "data": {
        "message": e
      },
      "status": "error"
    };
    return res.send(resultJson);

  }
  });


 //View my wallet balance
  app.get('/api/v1/wallet',authenticateAPIKey, (req, res) => {
    try{

    
      let strSQL = 'select * from custs where name = @custId';
      let params = {custId};
      let result = db.prepare(strSQL).all(params);
      
      console.log(result);

      let resultJSON = {
        "status":  "success",
        "data": {
          "wallet": {
            "id": result[0].name,          
            "status": (result[0].isEnabled>0?"enable":"disable"),
            "enabled_at": result[0].updatedAt,
            "balance": result[0].balance
          }
        } 
      }

      return res.send(resultJSON);

    } catch (e) {
      let resultJson = {
        "data": {
          "message": e
        },
        "status": "error"
      };
      return res.send(resultJson);

    }

  });

  //Add virtual money to my wallet
  app.post('/api/v1/wallet/deposits',authenticateAPIKey, (req, res) => {
    try {
      var amount  = req.body.amount;
      var reference_id  = req.body.reference_id;

      let strSQL = 'INSERT INTO trans(trans_type, cust_from, cust_to, value, createdAt, updatedAt) select 0, @reference_id, @custId,@amount, date(), date() WHERE EXISTS(SELECT 1 FROM custs WHERE name = @custId and isEnabled=1);';
      let params = {reference_id,custId,amount,custId};
      let resultInsert = db.prepare(strSQL).run(params);
      console.log("api/v1/wallet/deposits => ",resultInsert);
      let resultJSON = {};

      if(resultInsert.lastInsertRowid > 0){
      
            let strSQLInsert = 'UPDATE custs set balance = balance+@amount where name=@custId;';
            let paramInsert = {amount,custId};
            let resultUpdate = db.prepare(strSQLInsert).run(paramInsert);
            console.log(resultUpdate);


            let strSQLSelect = 'select * from trans where trans_id = @id';
            let id = resultInsert.lastInsertRowid;
            let paramSelect = {id};
            let result = db.prepare(strSQLSelect).all(paramSelect);
            console.log(result);

            resultJSON = {
              "status":  (resultInsert.changes>0?"success":"failed"),
              "data": {
                "deposit": {
                  "id": result[0].id,
                  "status":"success",
                  "deposited_at": result[0].createAt,
                  "amount": amount,
                  "reference_id": reference_id
                }
              } 
            }

           
    }else{
       resultJSON = {
        "status":  "failed",
        "data": {
          "deposit": {
            "status":"failed",           
            "amount": amount,
            "reference_id": reference_id
          }
        } 
      }

    }


    return res.send(resultJSON);

  } catch (e) {
    let resultJson = {
      "data": {
        "message": e
      },
      "status": "error"
    };

    console.log(e);
    return res.send(resultJson);

  }
  });

  //Use virtual money from my wallet
  app.post('/api/v1/wallet/withdrawals',authenticateAPIKey, (req, res) => {
    try {
      var amount  = req.body.amount;
      var reference_id  = req.body.reference_id;

      let strSQL = 'INSERT INTO trans(trans_type, cust_from, cust_to, value, createdAt, updatedAt) select 1, @reference_id, @custId,@amount, date(), date() WHERE EXISTS(SELECT 1 FROM custs WHERE name = @custId and isEnabled=1);';
      let params = {reference_id,custId,amount,custId};
      let resultInsert = db.prepare(strSQL).run(params);
      console.log("api/v1/wallet/deposits => ",resultInsert);
      let resultJSON = {};

      if(resultInsert.lastInsertRowid > 0){
      
            let strSQLInsert = 'UPDATE custs set balance = balance-@amount where name=@custId;';
            let paramInsert = {amount,custId};
            let resultUpdate = db.prepare(strSQLInsert).run(paramInsert);
            console.log(resultUpdate);


            let strSQLSelect = 'select * from trans where trans_id = @id';
            let id = resultInsert.lastInsertRowid;
            let paramSelect = {id};
            let result = db.prepare(strSQLSelect).all(paramSelect);
            console.log(result);

            resultJSON = {
              "status":  (resultInsert.changes>0?"success":"failed"),
              "data": {
                "withdrawal": {
                  "id": result[0].id,
                  "status":"success",
                  "withdrawal_at": result[0].createAt,
                  "amount": amount,
                  "reference_id": reference_id
                }
              } 
            }

           
    }else{
       resultJSON = {
        "status":  "failed",
        "data": {
          "withdrawal": {
            "status":"failed",           
            "amount": amount,
            "reference_id": reference_id
          }
        } 
      }

    }


    return res.send(resultJSON);

  } catch (e) {
    let resultJson = {
      "data": {
        "message": e
      },
      "status": "error"
    };

    console.log(e);
    return res.send(resultJson);

  }
  });


  //Disable my wallet
  app.patch('/api/v1/wallet',authenticateAPIKey, (req, res) => {
    try {
    let strSQL = 'update custs set isEnabled = 0 where name = @custId;';
    let params = {custId};
    let resultUpdate = db.prepare(strSQL).run(params);
    console.log(resultUpdate);

    let strSQLSelect = 'select * from custs where name = @custId';
    //params = {custId};
    let result = db.prepare(strSQLSelect).all(params);
    console.log(result);
    let resultJSON = {
      "status":  (resultUpdate.changes>0?"success":"failed"),
      "data": {
        "wallet": {
          "id": result[0].name,          
          "status": (result[0].isEnabled>0?"enable":"disable"),
          "enabled_at": result[0].updatedAt,
          "balance": result[0].balance
        }
      } 
    }

    return res.send(resultJSON);

  } catch (e) {
    let resultJson = {
      "data": {
        "message": e
      },
      "status": "error"
    };
    return res.send(resultJson);

  }
  });


app.listen(process.env.PORT, () =>
  console.log(`Mini-Wallet-Api listening on port ${process.env.PORT}!`),
);
