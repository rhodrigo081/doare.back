export const logger = {
    info:(message) => {
        console.error(`INFO: ${message}`);
    },
    success: (message) => {
        console.error(`SUCESS: ${message}`);
    },
    warn: (message) => {
        console.error(`WARN: ${message}`);
    },
    error: (message, errorObject) => {
        console.error(`ERROR: ${message}`);
        if(errorObject){
            console.error(`DETAILS: ${errorObject.message}`);
        }
    },
    fatal: (message, errorObject) => { 
        console.error(`FATAL ERROR: ${message}`);
        if(errorObject){
            console.error(`DETAILS: ${errorObject.message}`);
        }
        process.exit(1);
    }
}
