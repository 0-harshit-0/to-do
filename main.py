from dotenv import load_dotenv
import os
import uuid
from pymongo import MongoClient
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

load_dotenv()
apiVersion = os.environ["APIV"]
dbUser = os.environ["DBUSERNAME"]
dbPass = os.environ["DBPASSWORD"]
dbName = os.environ["DBNAME"]
dbColl1 = os.environ["DBCOLL1"]

app = FastAPI()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=apiVersion+"/token")


# Connect to MongoDB database
# using online mongoDB
mongoConnectURL = "paste your url here and replace username and password with {}{}".format(dbUser, dbPass)
client = MongoClient(mongoConnectURL)
db = client[dbName]
todoCollection = db[dbColl1]
valid_tokens = []


# Function to authenticate the user
async def authenticateUser(token: str = Depends(oauth2_scheme)):
    user = None
    if token in valid_tokens:
        user = {"username": "test_user", "password": "test_password"}

    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    return user




@app.post(apiVersion+"/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = None
    if form_data.username == "test" and form_data.password == "test":
        user = {"username": form_data.username}
    
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    # Generate a token for the user
    token = str(uuid.uuid4().hex)[:5]

    # Store the token and associate it with the user
    valid_tokens.append(token)

    return {"access_token": token, "token_type": "bearer"}

# Create a new To-do item
@app.post(apiVersion+"/todos")
async def create_todo(task: str, status: str, user = Depends(authenticateUser)):
    taskID = str(uuid.uuid4().hex)
    todoCollection.insert_one({"id": taskID, "task": task, "status": status})
    return {"message": "To-do item {} created successfully".format(taskID)}

# Get all To-do items
@app.get(apiVersion+"/todos")
async def read_todos(skip: int = 0, limit: int = 100, user = Depends(authenticateUser)):
    todos = todoCollection.find().skip(skip).limit(limit)
    return [{"task": todo["task"], "status": todo["status"]} for todo in todos]

# Get a single To-do item
@app.get(apiVersion+"/todos/{task_id}")
async def read_todo(task_id: str, user = Depends(authenticateUser)):
    todo = todoCollection.find_one({"id": task_id})
    return {"task": todo["task"], "status": todo["status"]}

# Update a To-do item
@app.put(apiVersion+"/todos/{task_id}")
async def update_todo(task_id: str, task: str, status: str, user = Depends(authenticateUser)):
    todoCollection.update_one({"id": task_id}, {"$set": {"task": task, "status": status}})
    return {"message": "To-do item updated successfully"}

# Delete a To-do item
@app.delete(apiVersion+"/todos/{task_id}")
async def delete_todo(task_id: str, user = Depends(authenticateUser)):
    todoCollection.delete_one({"id": task_id})
    return {"message": "To-do item deleted successfully"}

# uvicorn main:app --reload
