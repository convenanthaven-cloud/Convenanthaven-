const express = require('express');

const cors = require('cors');

const bodyParser = require('body-parser');

const app = express();

app.use(cors());

app.use(bodyParser.json());

app.get('/', (req, res) => {

  res.send('Paystack Thunkable Demo Server Running');

});

// later you will add your paystack endpoints here

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

