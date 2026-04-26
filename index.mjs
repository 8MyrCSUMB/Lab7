import 'dotenv/config'
import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';
const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
//for Express to get values using the POST method
app.use(express.urlencoded({ extended: true }));
//setting up database connection pool, replace values in red
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSW,
    database: process.env.DB,
    connectionLimit: 10,
    waitForConnections: true
});

// setting sessions
app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    // cookie: { secure: true }
}))

// middleware functions

function isUserAuthenticated(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect('/');
    }
}

app.get("/", (req, res) => {
    res.render('login.ejs');
})

// render form 
app.get("/newQuote", isUserAuthenticated, async (req, res) => {
    let authorsql = `SELECT authorId, firstName, lastName FROM authors;`
    const [authorsList] = await pool.query(authorsql);
    let catsql = `SELECT DISTINCT category FROM quotes;`
    const [catList] = await pool.query(catsql);

    res.render('newQuote.ejs', { authorsList, catList });
});

app.get("/newAuthor", isUserAuthenticated, (req, res) => {
    res.render('newAuthor.ejs');
});

// save to database
app.post("/newQuote", isUserAuthenticated, async (req, res) => {
    let quote = req.body.quote;
    let authorId = req.body.authorId;
    let category = req.body.category;
    console.log(quote + " " + authorId);
    const params = [quote, authorId, category];
    const [rows] = await pool.query(`INSERT INTO quotes (quote, authorId, category)
                VALUES (?, ?, ?)`, params);
    res.redirect("/quotes");
});

app.get("/allAuthors", async (req, res) => {
    let sql = `SELECT authorId, firstname, lastname FROM authors ORDER BY lastname;`
    const [authors] = await pool.query(sql);
    res.render("allAuthors.ejs", { authors });
})

app.get('/updateQuote', isUserAuthenticated, async (req, res) => {
    let quoteId = req.query.quoteId;
    let sql = `SELECT * FROM quotes WHERE quoteId = ?;`
    const [quoteInfo] = await pool.query(sql, [quoteId]);
    let authorsql = `SELECT authorId, firstName, lastName FROM authors;`
    const [authorsList] = await pool.query(authorsql);
    let categorysql = `SELECT DISTINCT category FROM quotes;`
    const [categoryList] = await pool.query(categorysql);

    res.render('updateQuote.ejs', { quoteInfo, authorsList, categoryList })
});

app.post("/updateQuote", isUserAuthenticated, async (req, res) => {
    let quoteId = req.body.quoteId;
    let authorId = req.body.authorId;
    let quote = req.body.quote;
    let category = req.body.category;

    let sql = `UPDATE quotes SET quote=?, category=?, authorId=? WHERE quoteId = ?;`
    const [update] = await pool.query(sql, [quote, category, authorId, quoteId]);
    console.log(update)
    res.redirect('/quotes');
})

app.get("/deleteAuthor", isUserAuthenticated, async (req, res) => {
    let authorId = req.query.authorId;

    let sql = `DELETE FROM authors WHERE authorId = ?;`
    const [deleteAuthor] = await pool.query(sql, [authorId]);
    res.redirect('/allAuthors');
})

app.get("/deleteQuote", isUserAuthenticated, async (req, res) => {
    let quoteId = req.query.quoteId;

    let sql = `DELETE FROM quotes WHERE quoteId = ?;`
    const [update] = await pool.query(sql, [quoteId]);
    console.log(update)
    res.redirect('/quotes');
})

app.get('/quotes', isUserAuthenticated, async (req, res) => {
    let sql = `SELECT quote, quoteId
              FROM quotes
              ORDER BY quote;`
    const [quotes] = await pool.query(sql);
    console.log(quotes);
    res.render('quotes.ejs', { quotes })
});

app.post("/newAuthor", isUserAuthenticated, async (req, res) => {
    let firstname = req.body.firstname;
    let lastname = req.body.lastname;
    let dob = req.body.dob;
    let dod = req.body.dod;
    let sex = req.body.sex;
    let profession = req.body.profession;
    let country = req.body.country;
    let portrait = req.body.portrait;
    let biography = req.body.biography;
    const params = [firstname, lastname, dob, dod, sex, profession, country, portrait, biography];
    const [rows] = await pool.query(`INSERT INTO authors (firstname, lastname, dob, dod, sex, profession, country, portrait, biography)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, params);
    res.redirect("/allAuthors");
});

app.get("/updateAuthor", isUserAuthenticated, async (req, res) => {
    let authorId = req.query.authorId;
    let sql = `SELECT *, DATE_FORMAT(dob, '%Y-%m-%d') ISOdob FROM authors WHERE authorId = ?;`
    const [authorInfo] = await pool.query(sql, authorId);
    console.log(authorInfo)
    res.render('updateAuthor.ejs', { authorInfo });
});


app.post("/updateAuthor", isUserAuthenticated, async (req, res) => {
    let authorId = req.body.authorId;
    let firstname = req.body.firstName;
    let sex = req.body.sex;
    let lastname = req.body.lastName;
    let dob = req.body.dob;
    let biography = req.body.bio
    let sql = `UPDATE authors SET firstname = ?, lastname = ?, dob = ?, sex = ?, biography = ? WHERE authorId = ?;`
    const [update] = await pool.query(sql, [firstname, lastname, dob, sex, biography, authorId]);
    console.log(update)
    res.redirect('/allAuthors');
})

// route that checks username and password
app.post('/loginProcess', async (req, res) => {
    // let username = req.body.username;
    // let password = req.body.password;
    let { username, password } = req.body;
    let hashedPassword = '';
    let sql = 'SELECT * FROM admin WHERE username = ?;'
    const [rows] = await pool.query(sql, [username]);

    if (rows.length > 0) { // username was found in the database
        hashedPassword = rows[0].password
    }

    const match = await bcrypt.compare(password, hashedPassword);

    if (match) {
        req.session.authenticated = true; // session variables
        req.session.fullName = rows[0].firstname + " " + rows[0].lastname;
        res.render('home.ejs', { "fullName": req.session.fullName });
    } else {
        let loginError = "Wrong Credentials ! Try Again !"
        // res.locals.loginError = "Wrong Credentials";
        res.render('login.ejs', { loginError });
    }
});

app.get('/logout', isUserAuthenticated, (req, res) => {
    req.session.destroy();
    res.redirect('/')
});

app.get("/dbTest", isUserAuthenticated, async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT CURDATE()");
        res.send(rows);
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).send("Database error!");
    }
});

app.listen(3000, () => {
    console.log("Express server running");
});
