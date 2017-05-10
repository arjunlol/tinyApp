var express = require("express");

const app = express();
const cookieParser = require('cookie-parser');
const PORT = process.env.PORT || 8080; // default port 8080
app.use(cookieParser());

//use EJS as templating engine
app.set("view engine", "ejs");

//simulate generating 'unique' shortURL
//will produce string of 6 ramdom alphanumeric chars
function generateRandomString() {
  return ((Math.random()).toString(36).substring(2,8));
};

let urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};

app.get("/", (req, res) => {
  res.end("Hello!");
});

//body-parser library allows to access POST request params
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended: true}));

//use urls_new template to render /urls/new endpoint
app.get("/urls/new", (req, res) => {
  let templateVars = {
    username: req.cookies["username"],
  }
  res.render("urls_new");
});

//updates url resource
app.post("/urls/:id", (req, res) => {
  urlDatabase[req.params.id] = req.body.updatedLongURL;
  console.log(req.body);
  res.redirect("/urls");
});

//adds post paramater to urlDatabase with short url key
app.post("/urls", (req, res) => {
  let urlShortened = generateRandomString();
  urlDatabase[urlShortened] = req.body.longURL;
  res.redirect(`/urls/${urlShortened}`);
});

//handle header form submission to login, redirect to /urls
app.post("/login", (req, res) => {
  //set cookie parameter to value submitted in request body form username
  res.cookie("username", req.body.username);

  let templateVars = {
    username: req.cookies["username"],
  }
  res.redirect('/urls');
  res.render('urls_index', templateVars);

});

//logout server logic
app.post("/logout", (req, res) => {
  res.clearCookie("username");
  res.redirect("/urls");
});


//route to handle shortURL request, will redirect to long URL
app.get("/u/:shortURL", (req, res) => {
  let longURL = urlDatabase[req.params.shortURL];
  res.redirect("http://"+longURL);
});

//post route that removes URL resource and redirects to index page
app.post("/urls/:id/delete", (req, res) => {
  delete urlDatabase[req.params.id];
  res.redirect("/urls");
});

//returns page that includes form with email + password field
app.get("/register", (req, res) => {
  res.render("register");
});



// route handler for /urls to pass URL data to template
app.get("/urls", (req, res) => {
  let templateVars = { urls: urlDatabase,
    username: req.cookies["username"]};
  res.render("urls_index", templateVars);
});


//route hander for page displaying single URL & shortened form
//end point formatted as ex. /urls/b2xVn2
app.get("/urls/:id", (req, res) => {
  let templateVars = { shortURL: req.params.id,
    URL: urlDatabase,
    username: req.cookies["username"]};
  res.render("urls_show", templateVars);
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