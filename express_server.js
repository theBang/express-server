const path = require('path');
const express = require('express');
const parseurl = require('parseurl');
const bodyParser = require('body-parser');
const session = require('express-session');
const morgan = require('morgan');
const mongoose = require('mongoose');

const PORT = 3000;
const { log } = console;

const app = express();
const Router = express.Router();

const userScheme = new mongoose.Schema(
  {
    login: String,
    password: String
  }, { versionKey: false }
);

const User = mongoose.model("User", userScheme);

const connString = 'mongodb://localhost:27017/usersdb';
mongoose.connect(connString, {useNewUrlParser: true});
mongoose.connection.on('connected', () => {
    log('Mongoose opened to ' + connString);
});
mongoose.connection.on('error', err => {
    log('Mongoose error: ' + err);
});
mongoose.connection.on('disconnected', () => {
    log('Mongoose disconnected');
});
process.on('SIGINT', () => {
    mongoose.connection.close(() => {
        log('Mongoose closed (app termination)');
        process.exit(0);
    });
});

app
  .use(morgan('combined'))
  .use(express.static(path.join(__dirname, '/public')))
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }))
  .use(session({
    secret: 'something secret',
    resave: false,
    saveUninitialized: true
  }));

app.set('view engine', 'pug');

const checkSignIn = (req, res, next) => {
   if(req.session.user){
      next();    
   } else {
      res.redirect('/login');
   }
};

Router
  .route('/signup')
  .get((req, res, next) => {
    let sess = req.session;
    res.render('signup', {
      title: 'Sign up',
      registered: sess.user ?
        true : false,
      login: sess.user ? 
        sess.user.login : undefined
    });
  })
  .post((req, res, next) => {
    if (!req.body.login || 
        !req.body.password) {
      res.status('400');
    } else {
      let login = req.body.login;
      let pass = req.body.password;
      let req_user = {login: login};
      User.findOne(req_user, (err, user) => {
        if(err) next(err);
        try {
          if(user && user.login == login){
            res.render('signup', {
              title: 'Sign up',
              login: login
            });
          } else {
            new User({
              login: login, 
              password: pass
            }).save(err => {
              if(err) next(err);
              req.session.user = req_user;
              res.redirect('/protected');
            });
          }
        } catch(err) {
          next(err);
        }
      });
    }
  });

Router
  .route('/login')
  .get((req, res) => {
    let sess = req.session;
    res.render('login', {
      title: 'Log in',
      login: sess.user ? 
        sess.user.login : undefined
    });
  }) 
  .post((req, res, next) => {
    if (!req.body.login || 
        !req.body.password) {
      res.status('400');
    } else {
      let login = req.body.login;
      let pass = req.body.password;
      let req_user = {login: login};
      User.findOne(req_user, (err, user) => {
        if(err) next(err);
        try {
          if(user && user.login == login && 
              user.password == pass){
            req.session.user = req_user;
            res.redirect('/protected');
          } 
          res.redirect('/signup');
        } catch(err) {
          next(err);
        }
      });
    }
  });

Router
  .route('/protected')
  .get(checkSignIn, (req, res) => {
    res.render('protected', {
      title: 'Protected Page',
      login: req.session.user.login
    });
  });

Router
  .route('/logout')
  .get((req, res) => {
    req.session.destroy();
    res.redirect('/login');
  });

app
  .use('/', Router)
  .use((req, res) => res.status(404).end('404'))
  .use((err, req, res, next) => res.status(500).end(`${err}`))
  .set('x-powered-by', false)
  .listen(process.env.PORT || PORT, () => 
    log(`pid: ${process.pid}; port: ${process.env.PORT || PORT}`));
  

