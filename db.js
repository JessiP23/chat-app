import { MongoClient } from "mongodb";

const uri = 'mongodb://localhost:27017/chatapp';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const connect = async () => {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
    }
};

export { client, connect };
