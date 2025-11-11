const express = require("express")
const app = express()
const path = require("path")

const port = 3005

app.listen(port, () => {
    console.log(`Listening on ${port}`)
})

app.use(express.static("public"));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Home.html"))
})
