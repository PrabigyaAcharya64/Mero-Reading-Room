
import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import UserManagementLanding from './UserManagementLanding';
import NewUsers from './NewUsers';
import AllMembersView from './AllMembersView';

function UserManagementModule({ onDataLoaded }) {
    const navigate = useNavigate();

    return (
        <Routes>
            <Route 
                path="/" 
                element={
                    <UserManagementLanding 
                        onNavigate={(path) => navigate(path)} 
                        onDataLoaded={onDataLoaded} 
                    />
                } 
            />
            <Route 
                path="/new-users" 
                element={
                    <NewUsers 
                        onBack={() => navigate('/admin/user-management')} 
                        onDataLoaded={onDataLoaded} 
                    />
                } 
            />
            <Route 
                path="/all-members" 
                element={
                    <AllMembersView 
                        onBack={() => navigate('/admin/user-management')} 
                        onDataLoaded={onDataLoaded} 
                    />
                } 
            />
        </Routes>
    );
}

export default UserManagementModule;
