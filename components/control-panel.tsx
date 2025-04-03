"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Search, MapPin, AlertTriangle, Sun, Moon, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface ControlPanelProps {
  onStartSimulation: (startPoint: string, destination: string, vehicleType: 'ambulance' | 'fire') => void
  onPreviewRoute: (startPoint: string, destination: string, vehicleType: 'ambulance' | 'fire') => void
  onResetSimulation: () => void
  isSimulationRunning: boolean
  currentDestination: string
  directions: string[]
  alerts: string[]
  onAddAmbulance: () => void
  ambulanceCount: number
  isDarkMode: boolean
  onToggleDarkMode: () => void
  routeInfo?: {
    distance: number
    duration: number
    remainingDistance: number
    remainingDuration: number
    savedTime: number
  }
}

// Predefined locations in Chandigarh
const CHANDIGARH_LOCATIONS = [
  { name: "Sector 17", coords: "30.7433,76.7839" },
  { name: "PGI Hospital", coords: "30.7649,76.7764" },
  { name: "Elante Mall", coords: "30.7056,76.8013" },
  { name: "Sukhna Lake", coords: "30.7426,76.8089" },
  { name: "Rock Garden", coords: "30.7512,76.8044" },
  { name: "ISBT Sector 43", coords: "30.7076,76.7913" },
  { name: "Chandigarh Railway Station", coords: "30.6798,76.8078" },
  { name: "Government Medical College", coords: "30.7372,76.7698" },
  { name: "Panjab University", coords: "30.7603,76.7664" },
  { name: "Chandigarh Airport", coords: "30.6735,76.7885" },
]

export function ControlPanel({
  onStartSimulation,
  onPreviewRoute,
  onResetSimulation,
  isSimulationRunning,
  currentDestination,
  directions,
  alerts,
  onAddAmbulance,
  ambulanceCount,
  isDarkMode,
  onToggleDarkMode,
  routeInfo,
}: ControlPanelProps) {
  const [startPoint, setStartPoint] = useState("")
  const [destination, setDestination] = useState("")
  const [emergencyType, setEmergencyType] = useState("ambulance")
  const [selectedStartLocation, setSelectedStartLocation] = useState("")
  const [selectedDestLocation, setSelectedDestLocation] = useState("")

  // Connect the narrator switch to the actual narrator functionality
  // Add this to the component

  const [isNarratorEnabled, setIsNarratorEnabled] = useState(false)

  // Add a function to handle narrator toggle
  const handleNarratorToggle = (checked: boolean) => {
    setIsNarratorEnabled(checked)

    // Dispatch a custom event that PriorityAlert can listen for
    const event = new CustomEvent("narrator-toggle", { detail: { enabled: checked } })
    window.dispatchEvent(event)

    // Provide feedback
    if (checked) {
      // Create a temporary alert to confirm narrator is enabled
      const alertElement = document.createElement("div")
      alertElement.className = "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50"
      alertElement.textContent = "Voice narrator enabled"
      document.body.appendChild(alertElement)

      setTimeout(() => {
        alertElement.style.opacity = "0"
        alertElement.style.transition = "opacity 0.5s"
        setTimeout(() => {
          document.body.removeChild(alertElement)
        }, 500)
      }, 2000)
    }
  }

  // Update input fields when predefined locations are selected
  useEffect(() => {
    if (selectedStartLocation) {
      const location = CHANDIGARH_LOCATIONS.find((loc) => loc.name === selectedStartLocation)
      if (location) {
        setStartPoint(location.coords)
      }
    }
  }, [selectedStartLocation])

  useEffect(() => {
    if (selectedDestLocation) {
      const location = CHANDIGARH_LOCATIONS.find((loc) => loc.name === selectedDestLocation)
      if (location) {
        setDestination(location.coords)
      }
    }
  }, [selectedDestLocation])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (startPoint.trim() && destination.trim()) {
      onStartSimulation(startPoint, destination, emergencyType as 'ambulance' | 'fire')

      // Auto-switch to directions tab after starting simulation
      const tabsElement = document.querySelector('[role="tablist"]')
      if (tabsElement) {
        const directionsTab = tabsElement.querySelector('[value="directions"]') as HTMLElement
        if (directionsTab) {
          setTimeout(() => {
            directionsTab.click()
          }, 500)
        }
      }
    } else {
      alert("Please enter both start point and destination")
    }
  }

  // Preview button click handler
  const handlePreviewClick = () => {
    if (startPoint.trim() && destination.trim()) {
      onPreviewRoute(startPoint, destination, emergencyType as 'ambulance' | 'fire')
    } else {
      alert("Please enter both start point and destination")
    }
  }

  // Format time in minutes and seconds
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className={`w-96 border-r ${isDarkMode ? "bg-gray-900 text-gray-100" : "bg-background"} p-4 overflow-y-auto`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Control Panel</h2>
        <Button variant="outline" size="icon" onClick={onToggleDarkMode}>
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>

      <Tabs defaultValue="route">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="route">Route Control</TabsTrigger>
          <TabsTrigger value="directions">Directions & Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="route">
          <Card className={isDarkMode ? "bg-gray-800 border-gray-700" : ""}>
            <CardHeader className={isDarkMode ? "text-white" : ""}>
              <CardTitle>Emergency Route Control</CardTitle>
              <CardDescription className={isDarkMode ? "text-gray-400" : ""}>
                Set start and destination points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Start Point Selection */}
                <div className="space-y-2">
                  <label className={isDarkMode ? "text-sm font-medium text-white" : "text-sm font-medium"}>
                    Start Location
                  </label>
                  <Select
                    disabled={isSimulationRunning}
                    value={selectedStartLocation}
                    onValueChange={setSelectedStartLocation}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select start location" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANDIGARH_LOCATIONS.map((location) => (
                        <SelectItem key={location.name} value={location.name}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="relative">
                    <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter start point coordinates"
                      className="pl-8"
                      value={startPoint}
                      onChange={(e) => setStartPoint(e.target.value)}
                      disabled={isSimulationRunning}
                    />
                  </div>
                </div>

                {/* Destination Selection */}
                <div className="space-y-2">
                  <label className={isDarkMode ? "text-sm font-medium text-white" : "text-sm font-medium"}>
                    Destination
                  </label>
                  <Select
                    disabled={isSimulationRunning}
                    value={selectedDestLocation}
                    onValueChange={setSelectedDestLocation}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANDIGARH_LOCATIONS.map((location) => (
                        <SelectItem key={location.name} value={location.name}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter destination coordinates"
                      className="pl-8"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      disabled={isSimulationRunning}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={isDarkMode ? "text-sm font-medium text-white" : "text-sm font-medium"}>
                    Emergency Vehicle Type
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={emergencyType === "ambulance" ? "default" : "outline"}
                      onClick={() => setEmergencyType("ambulance")}
                      disabled={isSimulationRunning}
                      className="flex-1"
                    >
                      🚑 Ambulance
                    </Button>
                    <Button
                      type="button"
                      variant={emergencyType === "fire" ? "default" : "outline"}
                      onClick={() => setEmergencyType("fire")}
                      disabled={isSimulationRunning}
                      className="flex-1"
                    >
                      🚒 Fire Truck
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      className={`flex-1 ${isSimulationRunning ? "bg-red-500 hover:bg-red-600" : ""}`} 
                      disabled={!startPoint.trim() || !destination.trim()}
                    >
                      {isSimulationRunning ? "Stop Simulation" : "Start Simulation"}
                    </Button>
                    
                    {!isSimulationRunning && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1"
                        onClick={handlePreviewClick}
                      >
                        Preview Route
                      </Button>
                    )}
                  </div>

                  {isSimulationRunning && (
                    <div className="mt-2">
                      <Button variant="secondary" size="sm" className="w-full" onClick={onAddAmbulance}>
                        Add Emergency Vehicle ({ambulanceCount})
                      </Button>
                    </div>
                  )}
                </div>
              </form>

              {isSimulationRunning && currentDestination && (
                <div className={`mt-4 rounded-md ${isDarkMode ? "bg-gray-700" : "bg-muted"} p-3`}>
                  <div className={isDarkMode ? "text-sm font-medium text-white" : "text-sm font-medium"}>
                    Active Emergency Route
                  </div>
                  <div className={isDarkMode ? "text-sm font-medium text-white" : "text-sm font-medium"}>
                    {currentDestination}
                  </div>

                  {routeInfo && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">
                          Distance: <span className="font-medium">{routeInfo.distance.toFixed(2)} km</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">
                          Estimated Time: <span className="font-medium">{formatTime(routeInfo.remainingDuration)}</span>
                          {routeInfo.savedTime > 0 && (
                            <span className="ml-1 text-green-500">(Saved {Math.floor(routeInfo.savedTime)}s)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={isDarkMode ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800"}
                    >
                      Route Active
                    </Badge>
                    <Badge
                      variant="outline"
                      className={isDarkMode ? "bg-yellow-900 text-yellow-300" : "bg-yellow-100 text-yellow-800"}
                    >
                      Traffic Lights Managed
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className={isDarkMode ? "bg-blue-900 text-blue-300" : "bg-blue-100 text-blue-800"}
                    >
                      {ambulanceCount} Ambulance{ambulanceCount > 1 ? "s" : ""} Active
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              {isSimulationRunning ? (
                <>
                  <Button variant="outline" onClick={onAddAmbulance} className="w-full">
                    Add Another Ambulance
                  </Button>
                  <Button variant="destructive" onClick={onResetSimulation} className="w-full">
                    Stop Simulation
                  </Button>
                </>
              ) : (
                <Button type="submit" onClick={handleSubmit} className="w-full">
                  Start Emergency Route
                </Button>
              )}
            </CardFooter>
          </Card>

          <div className="mt-4">
            <Card className={isDarkMode ? "bg-gray-800 border-gray-700" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Traffic Light Control:</span>
                    <Badge
                      variant="outline"
                      className={
                        isSimulationRunning
                          ? isDarkMode
                            ? "bg-green-900 text-green-300"
                            : "bg-green-100 text-green-800"
                          : isDarkMode
                            ? "bg-gray-700"
                            : "bg-gray-100"
                      }
                    >
                      {isSimulationRunning ? "Active" : "Standby"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Route Optimization:</span>
                    <Badge
                      variant="outline"
                      className={
                        isSimulationRunning
                          ? isDarkMode
                            ? "bg-green-900 text-green-300"
                            : "bg-green-100 text-green-800"
                          : isDarkMode
                            ? "bg-gray-700"
                            : "bg-gray-100"
                      }
                    >
                      {isSimulationRunning ? "Active" : "Standby"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Vehicle Tracking:</span>
                    <Badge
                      variant="outline"
                      className={
                        isSimulationRunning
                          ? isDarkMode
                            ? "bg-green-900 text-green-300"
                            : "bg-green-100 text-green-800"
                          : isDarkMode
                            ? "bg-gray-700"
                            : "bg-gray-100"
                      }
                    >
                      {isSimulationRunning ? "Active" : "Standby"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="directions">
          <Card className={isDarkMode ? "bg-gray-800 border-gray-700" : ""}>
            <CardHeader>
              <CardTitle>Turn-by-Turn Directions</CardTitle>
              <CardDescription className={isDarkMode ? "text-gray-400" : ""}>
                Navigation instructions for emergency vehicle
              </CardDescription>
            </CardHeader>
            <CardContent>
              {directions.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {directions.map((direction, index) => (
                    <div
                      key={index}
                      className={`p-2 border rounded-md ${index === 0 ? "border-[#0f53ff] bg-[#0f53ff10]" : ""}`}
                    >
                      <p className="text-sm">{direction}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  <p>No active route</p>
                </div>
              )}

              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1 text-yellow-500" />
                  Alerts
                </h3>
                {alerts.length > 0 ? (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {alerts.map((alert, index) => (
                      <div
                        key={index}
                        className={`p-2 border rounded-md ${isDarkMode ? "bg-yellow-900/30 border-yellow-800" : "bg-yellow-50"} ${index === 0 ? "border-[#0f53ff]" : ""}`}
                      >
                        <p className={`text-sm ${isDarkMode ? "text-yellow-300" : "text-yellow-800"}`}>{alert}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 text-center text-muted-foreground">
                    <p>No alerts</p>
                  </div>
                )}
              </div>

              {/* Update the Switch component in the directions tab */}
              <div className="mt-4 flex items-center space-x-2">
                <Switch id="narrator-mode" checked={isNarratorEnabled} onCheckedChange={handleNarratorToggle} />
                <Label htmlFor="narrator-mode">Enable Voice Narrator</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

