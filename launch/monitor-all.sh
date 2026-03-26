ps aux | grep "node.*index.js" | grep -v grep
ps aux | grep "uvicorn" | grep -v grep
ps aux | grep "npm" | grep -v grep

cd $HOME
mcporter list
cd $HOME/workspace/
