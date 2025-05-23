import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { Notifications } from 'react-native-notifications';
import useStorage from '../hooks/use-storage';

const requestAndroidNotificationPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);

        return result === PermissionsAndroid.RESULTS.GRANTED;
    }

    return true;
};

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useStorage('_push_notifications', []);
    const [lastNotification, setLastNotification] = useStorage('_last_push_notification');
    const [deviceToken, setDeviceToken] = useStorage('_device_token');
    const notificationListeners = useRef([]);

    // Function to add a listener
    const addNotificationListener = (callback) => {
        notificationListeners.current.push(callback);
    };

    // Function to remove a listener
    const removeNotificationListener = (callback) => {
        notificationListeners.current = notificationListeners.current.filter((listener) => listener !== callback);
    };

    useEffect(() => {
        const registerRemoteNotifications = async () => {
            await requestAndroidNotificationPermission();
            Notifications.registerRemoteNotifications();
        };

        registerRemoteNotifications();

        // Foreground notification handler
        const notificationDisplayedListener = Notifications.events().registerNotificationReceivedForeground((notification, completion) => {
            console.log('Notification received in foreground:', notification);
            setLastNotification(notification);
            setNotifications((prev) => [...prev, notification]);

            // Notify all listeners
            notificationListeners.current.forEach((listener) => listener(notification, 'received'));

            completion({ alert: true, sound: true, badge: false });
        });

        // Notification opened handler
        const notificationOpenedListener = Notifications.events().registerNotificationOpened((notification, completion, action) => {
            console.log('Notification opened:', notification);
            setLastNotification(notification);

            // Notify all listeners (optional, based on use case)
            notificationListeners.current.forEach((listener) => listener(notification, 'opened'));

            completion();
        });

        // Remote notifications registered successfully
        const registeredListener = Notifications.events().registerRemoteNotificationsRegistered((event) => {
            setDeviceToken(event.deviceToken);
            console.log('Device registered for remote notifications:', event.deviceToken);
        });

        // Failed to register for remote notifications
        const registrationFailedListener = Notifications.events().registerRemoteNotificationsRegistrationFailed((error) => {
            console.warn('Failed to register for remote notifications:', error);
        });

        // Clean up listeners on unmount
        return () => {
            notificationDisplayedListener.remove();
            notificationOpenedListener.remove();
            registeredListener.remove();
            registrationFailedListener.remove();
        };
    }, []);

    return (
        <NotificationContext.Provider value={{ notifications, lastNotification, deviceToken, addNotificationListener, removeNotificationListener }}>{children}</NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
