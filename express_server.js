var express = require("express");

const app = express();
const cookieParser = require('cookie-parser');
const PORT = process.env.PORT || 8080; // default port 8080
const bcrypt = require('bcrypt');
app.use(cookieParser());
let randomID = "";

//use EJS as templating engine
app.set("view engine", "ejs");

//simulate generating 'unique' shortURL
//will produce string of 6 ramdom alphanumeric chars
function generateRandomString() {
  return ((Math.random()).toString(36).substring(2,8));
};

//find a user that matches the email submitted and check password
function findLoginMatch (user) {
  for (let key in users) {
    if (users[key].email === user.email) {
      if (bcrypt.compareSync(user.password, users[key].password)){
        return key;
      } else {
        return 1; // password incorrect for that user
      }
    }
  }
  return 2; //email not found
}

//return subset of URL database that belongs to user with ID id
function urlsForUser (id) {
  let output = {};
  for (let key in urlDatabase) {
    if (urlDatabase[key].userID === id) {
      output[key] = urlDatabase[key];
    }
  }
  return output;
}

let urlDatabase = {
  "b2xVn2": {
    "urlLong": "http://www.lighthouselabs.ca",
    "userID": "userRandomID"
  },
  "9sm5xK": {
    "urlLong": "http://www.google.com",
    "userID": "user2RandomID"
  }
};

const users = {
  "userRandomID": {
    id: "userRandomID",
    email: "user@example.com",
    password: "purple-monkey-dinosaur"
  },
 "user2RandomID": {
    id: "user2RandomID",
    email: "user2@example.com",
    password: "dishwasher-funk"
  }
}

app.get("/", (req, res) => {
  res.end("Hello!");
});

//body-parser library allows to access POST request params
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended: true}));

//use urls_new template to render /urls/new endpoint
app.get("/urls/new", (req, res) => {

  //if not logged in redirect to login page
  if (!req.cookies["username"]){
    res.redirect("/login");
    return;
  };

  let templateVars = {
    urls: urlDatabase,
    username: req.cookies["username"]
  }
  res.render("urls_new", templateVars);
});

//updates url resource
app.post("/urls/:id", (req, res) => {
  urlDatabase[req.params.id].urlLong = req.body.updatedLongURL;
  urlDatabase[req.params.id].userID = req.cookies["username"].id;
  console.log(req.body);
  res.redirect("/urls");
});

//adds post paramater to urlDatabase with short url key
app.post("/urls", (req, res) => {
  let urlShortened = generateRandomString();
  urlDatabase[urlShortened] = {};
  urlDatabase[urlShortened]["urlLong"] = req.body.longURL;
  urlDatabase[urlShortened].userID = req.cookies.username.id;
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
    res.cookie("username", users[match]);
  }

  // let templateVars = {
  //   username: req.cookies["username"],
  // }
  res.redirect('/');
 // res.render('urls_index', templateVars);

});

app.get("/login", (req,res) => {
  res.render('login');
});


//logout server logic
app.post("/logout", (req, res) => {
  res.clearCookie("username");
  res.redirect("/urls");
});


//route to handle shortURL request, will redirect to long URL
app.get("/u/:shortURL", (req, res) => {
  let longURL = urlDatabase[req.params.shortURL].urlLong;
  res.redirect("http://"+longURL);
});

//post route that removes URL resource and redirects to index page
app.post("/urls/:id/delete", (req, res) => {
  //only delete if the user created that link
  if (req.cookies.username && req.cookies.username.id === urlDatabase[req.params.id].userID) {
    delete urlDatabase[req.params.id];
    res.redirect("/urls");
  } else {
    res.status(400).send("That's not your url!");
    return;
  }
});

//returns page that includes form with email + password field
app.get("/register", (req, res) => {
  res.render("register");
});

//adds new user object in users
//sets cookie to randomID
app.post("/register", (req, res) => {
  let randomID = generateRandomString();
  //registration handle error
  if(req.body.email === "" ||  bcrypt.hashSync(req.body.password,10) === ""){
    res.status(400).send("Please enter email");
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
console.log(users);
  res.cookie("username", users[randomID]);
  let templateVars = {urls: urlDatabase,
    username: req.cookies["username"],
  };
  res.redirect('/urls');
//  res.render('urls_index', templateVars);
//  res.redirect('/urls');
});

// route handler for /urls to pass URL data to template
app.get("/urls", (req, res) => {
  if (!req.cookies.username) {
    res.status(400).send("Please Login or Register");
    return;
  } else {
  let id = req.cookies.username.id;
  let templateVars = { urls: urlsForUser(id),
    username: req.cookies["username"]};
  res.render("urls_index", templateVars);
  }
});


//route hander for page displaying single URL & shortened form
//end point formatted as ex. /urls/b2xVn2
app.get("/urls/:id", (req, res) => {
  if (req.cookies.username && req.cookies.username.id === urlDatabase[req.params.id].userID) {
    let templateVars = { shortURL: req.params.id,
    urls: urlDatabase,
    username: req.cookies["username"]};
    res.render("urls_show", templateVars);
  } else {
    res.status(400).send("That's not your url!");
    return;
  };
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