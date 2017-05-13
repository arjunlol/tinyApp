const express = require("express");
const app = express();
const methodOverride = require('method-override');
const cookieSession = require('cookie-session');
const PORT = process.env.PORT || 8080; // default port 8080
const bcrypt = require('bcrypt');
//body-parser library allows to access POST request params
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended: true}));
//override with put or delete inplace of "method"
app.use(methodOverride('_method'));

app.use(cookieSession({
  name: 'session',
  keys: ['secret'],

  // Cookie Options
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

//use EJS as templating engine
app.set("view engine", "ejs");

//simulate generating 'unique' shortURL
//will produce string of 6 ramdom alphanumeric chars
function generateRandomString() {
  return ((Math.random()).toString(36).substring(2, 8));
};

//find a user that matches the email submitted and check password
function findLoginMatch (user) {
  for (let key in users) {
    if (users[key].email === user.email) {
      if (bcrypt.compareSync(user.password, users[key].password)){
        return key; //if valid user and password return the key
      } else {
        return 1; // password incorrect for that user
      }
    }
  }
  return 2; //email not found
};

//return subset of URL database that belongs to user with ID id
function findUrlsForUser (id) {
  let subset = {};
  for (let key in urlDatabase) {
    if (urlDatabase[key].userID === id) {
      subset[key] = urlDatabase[key];
    }
  }
  return subset;
};

//returns false if visitor is not unique to given url and true if never visited url
function isVisitorUnique (visitor, shorturl) {
  for (let id in visitors) {
    if (id === visitor){
      for (let index of visitors[visitor].shorturls) {
        if (index === shorturl) {
          return  false;
        }
      }
    }
  }
  return true;
};

let urlDatabase = {
  // example object inside database below
  // "b2xVn2": {
  //   "urlLong": "http://www.lighthouselabs.ca",
  //   "userID": "userRandomID", //user id that created
  //   "visitors": 0, //keep track how many times URL visited
  //   "uniqueVisitors": 0, //how many unique visitors
  //   "visitorID": [], //ids of everyone that visits (id is not session.visitor cookie id because you do not need to be logged in to see
  //   "timestamps": [] //first index is date created, then all times visited
  // }
};

const users = {
  //example users object below
  // "userRandomID": {
  //   id: "userRandomID",
  //   email: "user@example.com",
  //   password: iddd
  // }
};

const visitors = {
  //example visitors object below, help keep track of urls visited by session.visitor cookies
  // "visitorID": {
  //   id: "visitorID",
  //   shorturls: ["test","test2"],
  //   timestamps: []
  // }
};

app.get("/", (req, res) => {
  //if user is logged in redirect to /urls
  if (req.session.username) {
    res.redirect("/urls");
  } else { // else to /login
    res.redirect("/login");
  }
});


//use urls_new template to render /urls/new endpoint
app.get("/urls/new", (req, res) => {
  //if not logged in redirect to login page
  if (!req.session.username) {
    res.redirect("/login");
    return;
  };

  let templateVars = {
    urls: urlDatabase,
    username: req.session.username
  }
  res.render("urls_new", templateVars);
});

//route hander for page displaying single URL & shortened form
//end point formatted as ex. /urls/b2xVn2
app.get("/urls/:id", (req, res) => {
  //error message if url does not exist
  if(!urlDatabase[req.params.id]){
    res.status(404).send("URL does not exist!");
  } else if (!req.session.username) { //user not logged in
    res.redirect("/login");
  } else if (req.session.username.id === urlDatabase[req.params.id].userID) { //logged in user owns shorturl
    let templateVars = {
      shortURL: req.params.id,
      urls: urlDatabase,
      username: req.session.username,
      visit: visitors
    };
    res.render("urls_show", templateVars);
  } else { //logged in user doesn't own shorturl
    res.status(400).send("That's not your url!");
  };
});

//updates url resource
app.put("/urls/:id", (req, res) => {
  if(!req.session.username){
    res.status(403).send("Please login or register!");
    return;
  }

  if (!req.session.username.id === urlDatabase[req.params.id].userID) {
    res.status(403).send("That's not your url!");
    return;
  };

  urlDatabase[req.params.id].urlLong = req.body.updatedLongURL;
  urlDatabase[req.params.id].userID = req.session.username.id;
  res.redirect("/urls");
});

//adds post paramater to urlDatabase with short url key
app.post("/urls", (req, res) => {
    if(!req.session.username){
      res.status(403).send("Please login or register!");
    return;
  }
  let urlShortened = generateRandomString();
  urlDatabase[urlShortened] = {};
  urlDatabase[urlShortened]["urlLong"] = req.body.longURL;
  urlDatabase[urlShortened].userID = req.session.username.id;
  urlDatabase[urlShortened].timestamps = [new Date()]; //first index reps date created

  console.log(urlDatabase);
  res.redirect(`/urls/${urlShortened}`);
});

//handle header form submission to login, redirect to /urls
app.post("/login", (req, res) => {

  let user = {
    "email": req.body.email,
    "password": req.body.password
  };
  let match = findLoginMatch(user);
  if (match === 1){
    res.status(403).send("Invalid Password");
    return;
  } else if (match === 2){
    res.status(403).send("Invalid Password");
    return;
  } else {
    //set cookie parameter to value submitted in request body form username
    req.session.username = users[match];
  }

  // let templateVars = {
  //   username: req.session.username,
  // }
  res.redirect('/');
 // res.render('urls_index', templateVars);

});

app.get("/login", (req,res) => {
  if (req.session.username) {
    res.redirect('/urls');
  } else {
  res.render('login');
  }
});


//logout server logic
app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/urls");
});
//route to handle shortURL request, will redirect to long URL
app.get("/u/:shortURL", (req, res) => {

  if(!urlDatabase[req.params.shortURL]){
    res.status(404).send("URL does not exist!");
    return;
  }



  let longURL = urlDatabase[req.params.shortURL].urlLong;
  //track how many visitors
  if (!urlDatabase[req.params.shortURL].visitors) {
    urlDatabase[req.params.shortURL].visitors = 1;
  } else {
  urlDatabase[req.params.shortURL].visitors += 1;
  }

  //make the visitors object if no session cookie
  if (!req.session.visitor) {
    req.session.visitor = generateRandomString();
    console.log(req.session.visitor);
    visitors[req.session.visitor] = {
      id: req.session.visitor,
      shorturls: [req.params.shortURL],
      timestamps: [new Date()]
    };
    //add to visitor id & timespamps array
    if (!urlDatabase[req.params.shortURL].visitorID) {
      urlDatabase[req.params.shortURL].visitorID = [req.session.visitor];
      urlDatabase[req.params.shortURL].timestamps.push(new Date());
      urlDatabase[req.params.shortURL].uniqueVisitors = 1;
    } else {
      urlDatabase[req.params.shortURL].visitorID.push(req.session.visitor);
      urlDatabase[req.params.shortURL].timestamps.push(new Date());
      urlDatabase[req.params.shortURL].uniqueVisitors += 1;
    }
    //else user has a cookie, and is unique
  } else if (isVisitorUnique(req.session.visitor, req.params.shortURL)) {
    visitors[req.session.visitor].shorturls.push(req.params.shortURL);
    visitors[req.session.visitor].timestamps.push(new Date());
    //add to visitor id & timespamps array
    if (!urlDatabase[req.params.shortURL].visitorID) {
      urlDatabase[req.params.shortURL].visitorID = [req.session.visitor];
      urlDatabase[req.params.shortURL].uniqueVisitors = 1;
      urlDatabase[req.params.shortURL].timestamps.push(new Date());
    } else {
      urlDatabase[req.params.shortURL].visitorID.push(req.session.visitor);
      urlDatabase[req.params.shortURL].timestamps.push(new Date());
      urlDatabase[req.params.shortURL].uniqueVisitors += 1;
    }
    //else user visitor cookie and is not unique
  } else {
    visitors[req.session.visitor].timestamps.push(new Date());
    if (!urlDatabase[req.params.shortURL].visitorID) {
      urlDatabase[req.params.shortURL].visitorID = [req.session.visitor];
      urlDatabase[req.params.shortURL].uniqueVisitors = 1;
      urlDatabase[req.params.shortURL].timestamps.push(new Date());
    } else {
      urlDatabase[req.params.shortURL].visitorID.push(req.session.visitor);
      urlDatabase[req.params.shortURL].timestamps.push(new Date());
    }

  }
  console.log(visitors);
  console.log(urlDatabase);
  res.redirect("http://"+longURL);
});

//post route that removes URL resource and redirects to index page
app.delete("/urls/:id/delete", (req, res) => {
  //only delete if the user created that link
  if (req.session.username && req.session.username.id === urlDatabase[req.params.id].userID) {
    delete urlDatabase[req.params.id];
    res.redirect("/urls");
  } else {
    res.status(400).send("That's not your url!");
    return;
  }
});

//returns page that includes form with email + password field
app.get("/register", (req, res) => {

  if (req.session.username) {
    res.redirect('/urls');
  } else {
    res.render("register");
  }
});

//adds new user object in users
//sets cookie to randomID
app.post("/register", (req, res) => {
  let randomID = generateRandomString();
  //registration handle error
  if(req.body.email === "" ||  req.body.password === ""){
    res.status(400).send("Please fill in both email and password");
    return;
  };
  //check if email already registered
  for (let key in users){
    if (users[key].email === req.body.email){
      res.status(400).send("Email already registered");
      return;
    };
  };

  //append to users object
 users[randomID] = {
    id: randomID,
    email: req.body.email,
    password:  bcrypt.hashSync(req.body.password,10)
  }
  req.session.username = users[randomID];
  let templateVars = {urls: urlDatabase,
    username: req.session.username,
  };
  res.redirect('/urls');
//  res.render('urls_index', templateVars);
//  res.redirect('/urls');
});

// route handler for /urls to pass URL data to template
app.get("/urls", (req, res) => {
  if (!req.session.username) {
    res.status(400).send("Please Login or Register");
    return;
  } else {
  let id = req.session.username.id;
  let templateVars = { urls: findUrlsForUser(id),
    username: req.session.username};
  res.render("urls_index", templateVars);
  }
});



app.get("/urls.json", (req, res) => {
  res.json(urlDatabase);
})

app.get("/hello", (req, res) => {
  res.end("<html><body>Hello <b>World</b></body></html>\n");
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});