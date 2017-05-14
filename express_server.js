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

//only handles links for http
//checks if longurl has http at the start or wwww. defaults to https
function makeProperURL (longurl) {
  let properURL = "";
  if (longurl[0] === ".") { //if user enter .google.com
    longurl = longurl.slice(1);
  }
  if (longurl.search("http") > -1 ) {
    properURL += longurl;
  } else if (longurl.search("www") > -1) {
    properURL += "https://" + longurl;
  } else {
    properURL += "https://www." + longurl;
  }
  return properURL;
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
  if (!req.session.username) { //if not logged in redirect to login page
    res.redirect("/login");
  } else {
    let templateVars = {
      urls: urlDatabase,
      username: req.session.username
    };
    res.render("urls_new", templateVars);
  }
});

//route hander for page displaying single URL & shortened form
//end point formatted as ex. /urls/b2xVn2
app.get("/urls/:id", (req, res) => {
  if(!urlDatabase[req.params.id]){//error message if url does not exist
    res.status(404).send("URL does not exist!");
  } else if (!req.session.username) { //user not logged in
    res.redirect("/login");
  } else if (req.session.username.id === urlDatabase[req.params.id].userID) { //logged in user owns shorturl
    let templateVars = { //passes this object to html rendered page
      shortURL: req.params.id,
      urls: urlDatabase,
      username: req.session.username,
    };
    res.render("urls_show", templateVars);
  } else { //logged in user doesn't own shorturl
    res.status(403).send("That's not your url!");
  }
});

let loginHTML = "<html><body>Please <a href = '/login'>login</a> or <a href = '/register'>register</a>!</body></html>";

//updates url resource
app.put("/urls/:id", (req, res) => {
  if(!req.session.username){ //not logged in
    res.status(403).send(loginHTML);
  } else if (req.session.username.id !== urlDatabase[req.params.id].userID) { //logged in user not same as owner of shorturl
    res.status(403).send("That's not your url!");
  } else { //user owns shorturl
    urlDatabase[req.params.id].urlLong = makeProperURL(req.body.updatedLongURL);
    urlDatabase[req.params.id].userID = req.session.username.id;
    res.redirect("/urls");
  }
});

// route handler for /urls to pass URL data to template
app.get("/urls", (req, res) => {
  if (!req.session.username) { //not logged in
    res.status(403).send(loginHTML);
  } else { //user logged in, only send subset of url database that belongs to user
    let id = req.session.username.id;
    let templateVars = { urls: findUrlsForUser(id),
      username: req.session.username};
    res.render("urls_index", templateVars);
  }
});

//adds post paramater to urlDatabase with short url key. urls_new post form
app.post("/urls", (req, res) => {
  if(!req.session.username){
    res.status(403).send(loginHTML);
    return;
  }
  let urlShortened = generateRandomString();
  urlDatabase[urlShortened] = {
    "urlLong": makeProperURL(req.body.longURL),
    "userID": req.session.username.id,
    "visitors": 0, //keep track how many times URL visited
    "uniqueVisitors": 0,
    "visitorID": [],
    "timestamps": [new Date()] //first index reps date created]
  };
  res.redirect(`/urls/${urlShortened}`);
});

app.get("/login", (req,res) => {
  if (req.session.username) {
    res.redirect('/urls');
  } else {
  res.render('login');
  }
});

//handle header form submission to login, redirect to /urls
app.post("/login", (req, res) => {
  if(req.body.email === "" ||  req.body.password === ""){ //if user or pass left empty
    res.status(400).send("Please fill in both email and password");
    return;
  }
  let user = {
    "email": req.body.email,
    "password": req.body.password
  };
  let match = findLoginMatch(user); //return 1 if wrong pass, 2 if email doesn't exist, users id if pass and user match
  switch (match) {
    case 1:
      res.status(403).send("Invalid Password");
      break;
    case 2:
      res.status(403).send("Email not found");
      break
    default:
      //set cookie parameter to value submitted in request body form username
      req.session.username = users[match];
      res.redirect('/');
  }
});

//logout server logic
app.post("/logout", (req, res) => {
  req.session.username = null;
  res.redirect("/urls");
});

//returns page that includes form with email + password field
app.get("/register", (req, res) => {
  if (req.session.username) { //user already logged in
    res.redirect('/urls');
  } else { //user not logged in
    res.render("register");
  }
});

//adds new user object in users and set cookie
app.post("/register", (req, res) => {
  let randomID = generateRandomString();
  //check if email and password field filled
  if(req.body.email === "" ||  req.body.password === ""){
    res.status(400).send("Please fill in both email and password");
    return;
  }
  //check if email already registered
  for (let key in users){
    if (users[key].email === req.body.email){
      res.status(400).send("Email already registered");
      return;
    }
  }
  //append to users object
 users[randomID] = {
    id: randomID,
    email: req.body.email,
    password:  bcrypt.hashSync(req.body.password,10) //only store encrypted password
  }
  req.session.username = users[randomID]; //set cookie
  let templateVars = {urls: urlDatabase,
    username: req.session.username,
  };
  res.redirect('/urls');
});

//route to handle shortURL request, will redirect to long URL
app.get("/u/:shortURL", (req, res) => {
  if(!urlDatabase[req.params.shortURL]){ //no shorturl
    res.status(404).send("URL does not exist!");
    return;
  }

  let longURL = urlDatabase[req.params.shortURL].urlLong;
  //track how many visitors, and timestamps
  urlDatabase[req.params.shortURL].visitors += 1;
  urlDatabase[req.params.shortURL].timestamps.push(new Date());

  if (!req.session.visitor) { //make the visitors object if no session cookie
    req.session.visitor = generateRandomString();
    urlDatabase[req.params.shortURL].visitorID.push(req.session.visitor);
    urlDatabase[req.params.shortURL].uniqueVisitors += 1; //if no cookie visitor must be unique
    visitors[req.session.visitor] = { //easier to track which visitor visited which site
      id: req.session.visitor,
      shorturls: [req.params.shortURL],
    };
  } else if (isVisitorUnique(req.session.visitor, req.params.shortURL)) { //else if user has a cookie, and is unique
    urlDatabase[req.params.shortURL].visitorID.push(req.session.visitor); //add to visitor id & timespamps array
    urlDatabase[req.params.shortURL].uniqueVisitors += 1;
    visitors[req.session.visitor].shorturls.push(req.params.shortURL); //ad to list of urls visited
  } else { //else user visitor cookie and is not unique
    urlDatabase[req.params.shortURL].visitorID.push(req.session.visitor);
  }
  res.redirect(longURL);
});

//post route that removes URL resource and redirects to index page
app.delete("/urls/:id/delete", (req, res) => {
  //only delete if the user created that link
  if (req.session.username && req.session.username.id === urlDatabase[req.params.id].userID) {
    delete urlDatabase[req.params.id];
    res.redirect("/urls");
  } else {
    res.status(404).send("That's not your url!");
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