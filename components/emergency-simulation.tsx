"use client"

import React, { useEffect } from "react"
import { EmergencyVehicle } from "./emergency-vehicle"
import { TrafficLight } from "./traffic-light"
import { useEmergencyRoute } from "@/hooks/use-emergency-route"

export function EmergencySimulation() {
  const {
    vehicles,
    trafficLights,
    isSimulationActive,
    directions,
    alerts,
    currentDestination,
    routeInfo,
  } = useEmergencyRoute()

  // Add more visible debugging
  console.log("Emergency Simulation Component", {
    isSimulationActive,
    vehiclesCount: vehicles.length,
    trafficLightsCount: trafficLights.length,
    routeInfo
  });

  // Center the map on the vehicle if it's moving
  useEffect(() => {
    if (vehicles.length > 0 && isSimulationActive && window.googleMap) {
      console.log("Following emergency vehicle:", vehicles[0]);
      const mainVehicle = vehicles[0]
      
      // Follow the vehicle with smooth animation
      window.googleMap.panTo({
        lat: mainVehicle.position.lat,
        lng: mainVehicle.position.lng,
      })
      
      // Zoom in a bit for better visibility of traffic lights
      if (window.googleMap.getZoom() < 14) {
        window.googleMap.setZoom(14)
      }
    }
  }, [vehicles, isSimulationActive])

  // Don't return null even if simulation is not active
  // This allows us to debug and see if the component is being rendered
  if (!isSimulationActive) {
    console.log("Simulation is not active, but component is rendered");
    return (
      <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 bg-yellow-500 px-4 py-2 rounded-lg shadow-lg">
        Waiting for simulation to start...
      </div>
    );
  }

  return (
    <>
      {/* Render all traffic lights */}
      {trafficLights.map((light) => (
        <TrafficLight
          key={light.id}
          id={light.id}
          position={light.position}
          status={light.status}
        />
      ))}

      {/* Render all emergency vehicles */}
      {vehicles.map((vehicle) => (
        <EmergencyVehicle
          key={vehicle.id}
          id={vehicle.id}
          position={vehicle.position}
          route={vehicle.route}
          color={vehicle.color}
        />
      ))}

      {/* Dashboard with simulation information */}
      <div className="fixed right-4 top-4 z-50 flex flex-col space-y-2">
        {/* Visual indicators of traffic light status */}
        <div className="rounded-lg bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:bg-gray-800/90">
          <h3 className="mb-2 text-lg font-semibold">Traffic Light Status</h3>
          <div className="grid grid-cols-4 gap-2">
            <div className="text-xs">ID</div>
            <div className="text-xs">Status</div>
            <div className="text-xs">Distance</div>
            <div className="text-xs">Action</div>
            
            {trafficLights.map((light) => {
              // Find nearest vehicle to this light
              const nearestVehicle = vehicles[0]; // For simplicity, just use the first vehicle
              const distance = calculateDistance(nearestVehicle.position, light.position);
              
              return (
                <React.Fragment key={light.id}>
                  <div className="font-medium">{light.id}</div>
                  <div className="flex items-center space-x-1">
                    <span 
                      className={`h-3 w-3 rounded-full ${
                        light.status === "red" ? "bg-red-500" : 
                        light.status === "yellow" ? "bg-yellow-500" : 
                        "bg-green-500"
                      }`} 
                    />
                    <span className="text-xs capitalize">{light.status}</span>
                  </div>
                  <div className="text-sm">{(distance * 1000).toFixed(0)}m</div>
                  <div className="text-xs">
                    {distance < 0.2 ? 
                      <span className="text-green-500">Priority</span> : 
                      distance < 0.5 ? 
                        <span className="text-yellow-500">Preparing</span> : 
                        <span className="text-gray-500">Normal</span>
                    }
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
        
        {/* Destination */}
        <div className="rounded-lg bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:bg-gray-800/90">
          <h3 className="text-md font-semibold">Destination</h3>
          <p className="text-sm">{currentDestination}</p>
          {routeInfo.remainingDistance > 0 && (
            <div className="mt-2 text-sm">
              <div>Remaining: {routeInfo.remainingDistance.toFixed(2)} km</div>
              <div>ETA: {formatTime(routeInfo.remainingDuration)}</div>
              {routeInfo.savedTime > 0 && (
                <div className="text-green-500">
                  Time saved: {formatTime(routeInfo.savedTime)}
                </div>
              )}
              <div className="mt-1">
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{
                      width: `${(1 - routeInfo.remainingDistance / routeInfo.distance) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alerts and turn-by-turn directions */}
      <div className="fixed bottom-4 left-4 z-50 max-w-md">
        {/* Alerts */}
        <div className="mb-2 max-h-32 overflow-y-auto rounded-lg bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:bg-gray-800/90">
          <h3 className="mb-1 text-lg font-semibold">Alerts</h3>
          <ul className="space-y-1">
            {alerts.map((alert, index) => (
              <li 
                key={index} 
                className={`text-sm ${
                  alert.includes("IMPORTANT") ? "text-red-500 font-bold" : 
                  alert.includes("Traffic light") ? "text-green-500" : 
                  "text-gray-700 dark:text-gray-300"
                }`}
              >
                {alert}
              </li>
            ))}
          </ul>
        </div>

        {/* Turn-by-turn directions */}
        {directions.length > 0 && (
          <div className="rounded-lg bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:bg-gray-800/90">
            <h3 className="mb-1 text-lg font-semibold">Directions</h3>
            <ol className="list-decimal pl-5 text-sm">
              {directions.slice(0, 5).map((direction, index) => (
                <li key={index} dangerouslySetInnerHTML={{ __html: direction }} />
              ))}
            </ol>
          </div>
        )}
      </div>
    </>
  )
}

// Helper function to calculate distance between two points in kilometers
function calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180
  const dLng = ((point2.lng - point1.lng) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
      Math.cos((point2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Helper function to format time in minutes and seconds
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
} 