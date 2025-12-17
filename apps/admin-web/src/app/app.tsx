
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PersistGate } from 'redux-persist/integration/react';
import { Provider } from 'react-redux'
import { persistor, store } from '../redux/store';
import { MainRouter } from './router';
import { useEffect } from 'react';
import { Http } from '@aacesstalk/libs/ts-core';
import moment from 'moment-timezone';

export function App() {

    let base_url = import.meta.env.VITE_BACKEND_ADDRESS || "";

    console.log("Using backend address:", base_url)

    useEffect(()=>{
        Http.initialize(base_url, async () => { return moment.tz.guess(true) })
    },[])

    return (<Provider store={store}>
        <PersistGate persistor={persistor}>
            <MainRouter/>
        </PersistGate>
    </Provider>);
}

export default App;


