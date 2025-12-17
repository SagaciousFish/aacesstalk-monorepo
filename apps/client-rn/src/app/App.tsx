/* eslint-disable jsx-a11y/accessible-emoji */
import React, { useEffect, useRef, useState } from 'react';
import { Provider } from 'react-redux';
import { store, persistor } from '../redux/store';
import { BackHandler, Platform, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { NativeStackNavigationOptions, createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignInScreen } from '../features/auth/screens/SignInScreen';
import { useSelector } from '../redux/hooks';
import { MainNavigator } from '../navigation/main';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Http } from '@aacesstalk/libs/ts-core';
import { getTimeZone } from 'react-native-localize';
import { useKeepAwake } from '@sayem314/react-native-keep-awake';
import Toast from 'react-native-toast-message';
import DeviceInfo from 'react-native-device-info';
import { toastConfig } from '../components/toast';

const Stack = createNativeStackNavigator()

const screenOptions: NativeStackNavigationOptions = {
  headerShown: false,
}

const GlobalNavigator = () => {

  const isSignedIn = useSelector(state => {
    return state.auth.jwt != null
  })

  return <Stack.Navigator screenOptions={screenOptions} id={undefined}>
  {
      isSignedIn ? (<Stack.Screen name="Home" component={MainNavigator} />) :
    (<Stack.Screen name="Auth" component={SignInScreen}/>)
  }
</Stack.Navigator>
}

export const App = () => {

  useKeepAwake()

  useEffect(()=>{
    const isEmulator = DeviceInfo.isEmulatorSync()
    let host: string
    if(isEmulator){
      if(Platform.OS == 'android'){
        console.log("Running on Android emulator. Use the host address http://10.0.2.2:3000")
        host = "http://10.0.2.2:3000"
      }else{
        host = "http://localhost:3000"
      }
    } else {
      // For physical devices (including wired debug), use BACKEND_ADDRESS or fallback
      host = process.env["BACKEND_ADDRESS"];
      if (!host) {
        console.warn("BACKEND_ADDRESS not set. Falling back to localhost for physical device.");
        host = "http://localhost:3000"; // Or a more appropriate default, e.g., production URL
      }
      console.log(`Running on physical device`);
    }
    console.log(`Host address: ${host}`)
    Http.initialize(host, async () => {return getTimeZone()})
  }, [])


  return <Provider store={store}>
    <PersistGate persistor={persistor}>
      <SafeAreaProvider>
        <GestureHandlerRootView className="flex-1">
          <NavigationContainer>
              <GlobalNavigator/>
          </NavigationContainer>
        </GestureHandlerRootView>
        <Toast config={toastConfig}/>
      </SafeAreaProvider>
    </PersistGate>
  </Provider>
};

export default App;
