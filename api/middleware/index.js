import cors from "cors";
import bodyParser from "body-parser";


// middleware function to register cors and bodyParser middleware
const registerMiddleware = (app) => {
  // use CORS middleware
  // if in production, allow requests only from APP_URL
  if (process.env.ENV === "production") {

    const corsOptions = {
     

      origin: "http://localhost:3000",
      
      optionsSuccessStatus: 200, //
    };
    app.use(cors(corsOptions));
  } else {
    
    
    app.use(cors());
  }
  
  
  // use bodyParser middleware to parse request bodies as JSON
  app.use(bodyParser.json());
};

// export the middleware function
export { registerMiddleware };
