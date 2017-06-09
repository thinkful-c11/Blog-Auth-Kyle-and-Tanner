'use strict';

const {BasicStrategy} = require('passport-http');
const express = require('express');
const jsonParser = require('body-parser').json();
const passport = require('passport');

const {Users} = require('./models');
const router = express.Router();

router.use(jsonParser);

const basicStrategy = new BasicStrategy((username, password, callback)=>{
  let user;
  Users
        .findOne({username: username})
        .exec()
        .then(_user => {
          user = _user;
          if(!user){
            return callback(null, false);
          }
          return user.validatePassword(password);
        })
        .then(isValid => {
          if (!isValid){
            return callback(null, false);
          }
          else {
            return callback(null, user);
          }
        })
        .catch(err => callback(err));
});

passport.use(basicStrategy);
router.use(passport.initialize());

router.post('/', (req, res)=>{
  if(!req.body){
    return res.status(400).json({message: 'No request body'});
  }
  if(!('username' in req.body)){
    return res.status(422).json({message: "Missing field: username"});
  }
  let {username, password, firstName, lastName} = req.body;

  if(typeof username !== 'string'){
    return res.status(422).json({message: 'Incorrect field type: username'});
  };
  
  username = username.trim();

  if (username === ''){
    return res.status(422).json({message: 'Incorrect field length: username'});
  }

  if(!(password)) {
    return res.status(422).json({message: 'Missing field: password'});
  }

  if(typeof password !== 'string'){
    return res.status(422).json({message: 'Incorrect field type: password'});
  }

  password = password.trim();

  if (password === ''){
    return res.status(422).json({message: 'Incorrect field length: password'});
  }

  return Users
      .find({username})
      .count()
      .exec()
      .then(_res =>{
        if (_res > 0){
          return res.status(422).json({message: 'that username already exists, try another.'});
        }
        return Users.hashPassword(password);
      })
        .then(hash =>{
          return Users
            .create({
              username: username,
              password: hash,
              firstName: firstName,
              lastName: lastName
            });
        })
        .then(user =>{
          return res.status(201).send(user.apiRepr());
        })
        .catch(err =>{
          res.status(500).json({message: 'Internal server error.'});
        });
});

const thatMiddleware = (req, res, next) => {
  if (!req.headers.Authorization) {
    return res.sendStatus(401);
  }
  next();
}

router.get('/', passport.authenticate('basic', {session: false}), (req, res)=>{
  return Users
    .find()
    .exec()
    .then(users =>{
      res.json(users.map(user => user.apiRepr()));
    })
    .catch(err=> console.log(err) && res.status(500).json({message: 'Internal server error.'}));
});

router.get('/me', passport.authenticate('basic', {session: false}), (req, res) =>{
  res.json({user: req.user.apiRepr()});
});

module.exports = router;